// Mock Paystack API for local development and e2e tests.
//
//   node tests/mocks/paystack-mock.mjs            (listens on :4010)
//   PAYSTACK_API_URL=http://<host>:4010            (set on the Edge Functions)
//
// Implements the endpoints the app uses, a fake hosted checkout page, and sends
// HMAC-signed webhooks (charge.success, transfer.success) to the real
// paystack-webhook function, so the full pay → handover → payout loop runs
// locally without touching Paystack.
import http from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';

const PORT = Number(process.env.PAYSTACK_MOCK_PORT ?? 4010);
const PUBLIC_URL = process.env.PAYSTACK_MOCK_PUBLIC_URL ?? `http://localhost:${PORT}`;
const SECRET = process.env.PAYSTACK_SECRET_KEY ?? 'sk_test_replace_me';
const WEBHOOK_URL = process.env.PAYSTACK_WEBHOOK_URL ?? 'http://127.0.0.1:54321/functions/v1/paystack-webhook';

const state = { transactions: new Map(), transfers: new Map(), refunds: [], recipients: new Map(), webhooks: [] };
let nextId = 1000;

const BANKS = [
  { name: 'Access Bank', code: '044', active: true },
  { name: 'Guaranty Trust Bank', code: '058', active: true },
  { name: 'Kuda Bank', code: '50211', active: true },
  { name: 'Opay', code: '999992', active: true },
  { name: 'Zenith Bank', code: '057', active: true },
];

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}
const ok = (res, data, message = 'ok') => send(res, 200, { status: true, message, data });
const fail = (res, status, message) => send(res, status, { status: false, message });

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function sendWebhook(event, data) {
  const body = JSON.stringify({ event, data });
  const signature = createHmac('sha512', SECRET).update(body).digest('hex');
  try {
    const r = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
      body,
    });
    state.webhooks.push({ event, reference: data.reference, status: r.status });
    return r.status;
  } catch (e) {
    state.webhooks.push({ event, reference: data.reference, status: 0, error: String(e) });
    return 0;
  }
}

function authorized(req) {
  return req.headers.authorization === `Bearer ${SECRET}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  const path = url.pathname;

  // --- Hosted checkout (browser) ----------------------------------------------
  let m = path.match(/^\/checkout\/([^/]+)$/);
  if (m && req.method === 'GET') {
    const tx = state.transactions.get(decodeURIComponent(m[1]));
    if (!tx) return fail(res, 404, 'Transaction not found');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Mock Paystack</title>
      <body style="font-family:system-ui;padding:24px"><h1>Mock Paystack checkout</h1>
      <p>Amount: ₦${(tx.amount / 100).toLocaleString()}</p>
      <form method=post action="/checkout/${encodeURIComponent(tx.reference)}/pay"><button style="font-size:18px;padding:12px 24px">Pay now</button></form>
      <form method=post action="/checkout/${encodeURIComponent(tx.reference)}/cancel"><button>Cancel</button></form></body>`);
  }
  m = path.match(/^\/checkout\/([^/]+)\/(pay|cancel)$/);
  if (m && req.method === 'POST') {
    const tx = state.transactions.get(decodeURIComponent(m[1]));
    if (!tx) return fail(res, 404, 'Transaction not found');
    if (m[2] === 'pay') {
      tx.status = 'success';
      tx.paid_at = new Date().toISOString();
      await sendWebhook('charge.success', { id: tx.id, reference: tx.reference, amount: tx.amount, currency: 'NGN', status: 'success' });
    } else {
      tx.status = 'abandoned';
    }
    res.writeHead(302, { Location: `${tx.callback_url}${tx.callback_url.includes('?') ? '&' : '?'}reference=${encodeURIComponent(tx.reference)}` });
    return res.end();
  }

  // --- Test helpers ------------------------------------------------------------
  if (path === '/__state') {
    return send(res, 200, {
      transactions: [...state.transactions.values()],
      transfers: [...state.transfers.values()],
      refunds: state.refunds,
      webhooks: state.webhooks,
    });
  }
  m = path.match(/^\/__replay\/charge\/([^/]+)$/);
  if (m && req.method === 'POST') {
    const tx = state.transactions.get(decodeURIComponent(m[1]));
    if (!tx) return fail(res, 404, 'Transaction not found');
    const status = await sendWebhook('charge.success', { id: tx.id, reference: tx.reference, amount: tx.amount, currency: 'NGN' });
    return send(res, 200, { webhook_status: status });
  }

  // --- API (requires secret key) -----------------------------------------------
  if (!authorized(req)) return fail(res, 401, 'Invalid key');

  if (path === '/transaction/initialize' && req.method === 'POST') {
    const b = await readJson(req);
    if (!b.email || !Number.isInteger(b.amount) || !b.reference) return fail(res, 400, 'Invalid params');
    if (state.transactions.has(b.reference)) return fail(res, 400, 'Duplicate Transaction Reference');
    const tx = {
      id: nextId++, reference: b.reference, amount: b.amount, currency: b.currency ?? 'NGN', email: b.email,
      callback_url: b.callback_url, channels: b.channels, status: 'pending', access_code: randomBytes(8).toString('hex'),
    };
    state.transactions.set(tx.reference, tx);
    return ok(res, {
      authorization_url: `${PUBLIC_URL}/checkout/${encodeURIComponent(tx.reference)}`,
      access_code: tx.access_code,
      reference: tx.reference,
    }, 'Authorization URL created');
  }

  m = path.match(/^\/transaction\/verify\/([^/]+)$/);
  if (m && req.method === 'GET') {
    const tx = state.transactions.get(decodeURIComponent(m[1]));
    if (!tx) return fail(res, 400, 'Transaction reference not found');
    return ok(res, { id: tx.id, status: tx.status === 'pending' ? 'abandoned' : tx.status, reference: tx.reference, amount: tx.amount, currency: tx.currency });
  }

  if (path === '/refund' && req.method === 'POST') {
    const b = await readJson(req);
    if (!state.transactions.has(b.transaction)) return fail(res, 400, 'Transaction not found');
    if (state.refunds.includes(b.transaction)) return fail(res, 400, 'Transaction has been fully reversed');
    state.refunds.push(b.transaction);
    return ok(res, { status: 'pending', transaction: b.transaction });
  }

  if (path === '/bank' && req.method === 'GET') return ok(res, BANKS);

  if (path === '/bank/resolve' && req.method === 'GET') {
    const acct = url.searchParams.get('account_number');
    if (!/^\d{10}$/.test(acct ?? '') || acct === '0000000000') return fail(res, 422, 'Could not resolve account name');
    return ok(res, { account_number: acct, account_name: 'ADAEZE TEST OKAFOR' });
  }

  if (path === '/transferrecipient' && req.method === 'POST') {
    const b = await readJson(req);
    const code = `RCP_${createHmac('sha256', 'r').update(`${b.bank_code}:${b.account_number}`).digest('hex').slice(0, 12)}`;
    state.recipients.set(code, b);
    return ok(res, { recipient_code: code, active: true });
  }

  if (path === '/transfer' && req.method === 'POST') {
    const b = await readJson(req);
    if (!state.recipients.has(b.recipient)) return fail(res, 400, 'Recipient not found');
    if (state.transfers.has(b.reference)) return fail(res, 400, 'Transfer reference already exists');
    const t = { id: nextId++, reference: b.reference, amount: b.amount, recipient: b.recipient, status: 'pending',
                transfer_code: `TRF_${randomBytes(6).toString('hex')}` };
    state.transfers.set(t.reference, t);
    // Paystack settles asynchronously and reports via webhook.
    setTimeout(() => {
      t.status = 'success';
      void sendWebhook('transfer.success', { id: t.id, reference: t.reference, amount: t.amount, transfer_code: t.transfer_code });
    }, 300);
    return ok(res, { transfer_code: t.transfer_code, status: 'pending', reference: t.reference });
  }

  return fail(res, 404, `Mock has no route for ${req.method} ${path}`);
});

server.listen(PORT, '0.0.0.0', () => console.log(`mock paystack on ${PUBLIC_URL} → webhooks to ${WEBHOOK_URL}`));
