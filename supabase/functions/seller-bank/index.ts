// GET  /functions/v1/seller-bank           → list of Nigerian banks
// POST /functions/v1/seller-bank { bank_code, account_number }
//      → resolves the account name with Paystack, creates a transfer recipient
//        and saves it for the signed-in seller.
import { paystackClient } from '../_shared/deps.ts';
import { json, preflight } from '../_shared/http.ts';
import { PaystackError } from '../_shared/paystack.ts';
import { getUser, serviceClient } from '../_shared/supabase.ts';

let bankCache: { at: number; banks: { name: string; code: string }[] } | null = null;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const user = await getUser(req);
  if (!user) return json({ error: 'not_authenticated' }, 401);
  const ps = paystackClient();

  try {
    if (req.method === 'GET') {
      if (!bankCache || Date.now() - bankCache.at > 6 * 3600_000) {
        const banks = (await ps.listBanks()).filter((b) => b.active).map((b) => ({ name: b.name, code: b.code }));
        bankCache = { at: Date.now(), banks };
      }
      return json({ banks: bankCache.banks });
    }
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    if (!user.phone_confirmed_at) return json({ error: 'not_verified' }, 403);
    const { bank_code: bankCode, account_number: accountNumber, bank_name: bankName } = await req.json().catch(() => ({}));
    if (typeof bankCode !== 'string' || !/^\d{10}$/.test(String(accountNumber))) {
      return json({ error: 'bad_request' }, 400);
    }
    const resolved = await ps.resolveAccount(accountNumber, bankCode);
    const recipient = await ps.createRecipient({
      name: resolved.account_name, account_number: accountNumber, bank_code: bankCode,
    });
    const { error } = await serviceClient().rpc('save_seller_bank', {
      p_seller_id: user.id,
      p_bank_code: bankCode,
      p_bank_name: typeof bankName === 'string' ? bankName.slice(0, 80) : null,
      p_account_number: accountNumber,
      p_account_name: resolved.account_name,
      p_recipient_code: recipient.recipient_code,
    });
    if (error) return json({ error: 'server_error' }, 500);
    return json({ account_name: resolved.account_name });
  } catch (e) {
    if (e instanceof PaystackError && e.status < 500) return json({ error: 'account_not_resolved' }, 422);
    console.error('seller-bank', (e as Error).message);
    return json({ error: 'payment_provider_error' }, 502);
  }
});
