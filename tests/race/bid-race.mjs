// Bid race test: fires concurrent bids at place_bid over real connections.
// Requires the local Supabase stack (`supabase start`).
//
// Asserts:
//  1. 50 concurrent bids across 10 price levels: at most one accepted per level,
//     accepted amounts strictly increase by >= step, current_bid = max accepted.
//  2. 50 concurrent bids at the SAME amount: exactly one accepted.
//  3. 50 concurrent bids after ends_at: none accepted.
//  4. Bids fired across the closing boundary: no accepted bid has created_at >= ends_at.
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const N = 50;
const pool = new pg.Pool({ connectionString: DB_URL, max: N + 5 });

async function admin(sql, params) {
  return (await pool.query(sql, params)).rows;
}

async function createUser() {
  const id = randomUUID();
  const phone = '234' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
  await admin(
    `insert into auth.users (id, phone, phone_confirmed_at, aud, role)
     values ($1, $2, now(), 'authenticated', 'authenticated')`,
    [id, phone],
  );
  return id;
}

async function bidAs(uid, auctionId, amount) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('role', 'authenticated', true),
                               set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    const { rows } = await client.query('select public.place_bid($1, $2) as r', [auctionId, amount]);
    await client.query('commit');
    return { uid, amount, ...rows[0].r };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function createAuction(sellerId, { startPrice = 100000, endsInSec = 300 } = {}) {
  const [drop] = await admin(
    `insert into public.drops (title, opens_at, first_close_at)
     values ('Race drop', now() - interval '1 minute', now() + interval '1 hour') returning id`);
  const [a] = await admin(
    `insert into public.auctions (drop_id, seller_id, slot, title, condition, category, area,
                                  start_price, step, starts_at, ends_at)
     values ($1, $2, 0, 'Race lot', 'good', 'Electronics', 'Yaba', $3, public.step_for($3),
             now() - interval '1 minute', clock_timestamp() + make_interval(secs => $4))
     returning id, step`,
    [drop.id, sellerId, startPrice, endsInSec]);
  return { id: a.id, step: Number(a.step) };
}

async function auctionRow(id) {
  const [a] = await admin('select current_bid, bid_count, ends_at, leader_id from public.auctions where id = $1', [id]);
  return a;
}

let failures = 0;
async function scenario(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`  ok   ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

async function main() {
  console.log(`bid race test against ${DB_URL.replace(/:[^:@/]+@/, ':***@')}`);
  const seller = await createUser();
  const bidders = await Promise.all(Array.from({ length: N }, createUser));

  await scenario(`${N} concurrent bids over 10 price levels`, async () => {
    const lot = await createAuction(seller);
    const levels = 10;
    const results = await Promise.all(bidders.map((uid, i) =>
      bidAs(uid, lot.id, 100000 + (i % levels) * lot.step)));
    const accepted = results.filter((r) => r.ok);
    assert.ok(accepted.length >= 1, 'at least one bid accepted');

    const perLevel = new Map();
    for (const r of accepted) perLevel.set(r.amount, (perLevel.get(r.amount) ?? 0) + 1);
    for (const [amount, count] of perLevel) {
      assert.equal(count, 1, `price level ${amount} accepted ${count} times`);
    }

    const row = await auctionRow(lot.id);
    const maxAccepted = Math.max(...accepted.map((r) => r.amount));
    assert.equal(Number(row.current_bid), maxAccepted, 'current_bid equals max accepted bid');
    assert.equal(row.bid_count, accepted.length, 'bid_count equals accepted count');

    const { rows: history } = await pool.query(
      'select amount, bidder_id from public.bids where auction_id = $1 order by created_at, amount', [lot.id]);
    assert.equal(history.length, accepted.length, 'one bids row per accepted bid');
    for (let i = 1; i < history.length; i++) {
      assert.ok(Number(history[i].amount) >= Number(history[i - 1].amount) + lot.step,
        `bid ${i} (${history[i].amount}) is at least one step above previous (${history[i - 1].amount})`);
    }
    const rejected = results.filter((r) => !r.ok);
    for (const r of rejected) assert.equal(r.reason, 'too_low', `rejection reason ${r.reason}`);
    console.log(`       ${accepted.length} accepted / ${rejected.length} rejected (too_low)`);
  });

  await scenario(`${N} concurrent bids at the same amount`, async () => {
    const lot = await createAuction(seller);
    const results = await Promise.all(bidders.map((uid) => bidAs(uid, lot.id, 100000)));
    const accepted = results.filter((r) => r.ok);
    assert.equal(accepted.length, 1, `exactly one accepted, got ${accepted.length}`);
    const row = await auctionRow(lot.id);
    assert.equal(Number(row.current_bid), 100000);
    assert.equal(row.leader_id, accepted[0].uid);
  });

  await scenario(`${N} concurrent bids after ends_at`, async () => {
    const lot = await createAuction(seller, { endsInSec: 1 });
    await admin(`update public.auctions set ends_at = clock_timestamp() - interval '1 second' where id = $1`, [lot.id]);
    const results = await Promise.all(bidders.map((uid, i) => bidAs(uid, lot.id, 100000 + i * lot.step)));
    assert.equal(results.filter((r) => r.ok).length, 0, 'no bid accepted after ends_at');
    for (const r of results) assert.equal(r.reason, 'ended');
    const row = await auctionRow(lot.id);
    assert.equal(row.current_bid, null);
  });

  await scenario('bids fired across the closing boundary', async () => {
    // Ends in 1s. Bids keep arriving for 2.5s; soft close extends on each accepted bid.
    const lot = await createAuction(seller, { endsInSec: 1 });
    const deadline = Date.now() + 2500;
    let amount = 100000;
    const results = [];
    let wave = 0;
    while (Date.now() < deadline) {
      const batch = bidders.slice((wave * 10) % N, (wave * 10) % N + 10);
      const base = amount;
      results.push(...await Promise.all(batch.map((uid, i) => bidAs(uid, lot.id, base + i * lot.step))));
      amount = base + 10 * lot.step;
      wave++;
      if (wave === 2) {
        // Force the lot to end now, so later waves must all be rejected.
        await admin(`update public.auctions set ends_at = clock_timestamp() where id = $1`, [lot.id]);
      }
    }
    const row = await auctionRow(lot.id);
    const { rows: late } = await pool.query(
      'select count(*)::int as n from public.bids where auction_id = $1 and created_at >= $2', [lot.id, row.ends_at]);
    assert.equal(late[0].n, 0, 'no accepted bid at or after ends_at');
    const afterClose = results.slice(20);
    assert.equal(afterClose.filter((r) => r.ok).length, 0, 'no bid accepted after forced close');
  });

  await pool.end();
  if (failures) {
    console.log(`\n${failures} scenario(s) failed`);
    process.exit(1);
  }
  console.log('\nall race scenarios passed');
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
