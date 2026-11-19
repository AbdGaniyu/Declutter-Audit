// Minimal Paystack API client. No Deno APIs, so it also runs under Node tests.
// Docs: https://paystack.com/docs/api/

export type PaystackConfig = { secretKey: string; baseUrl?: string; fetch?: typeof fetch };

export class PaystackError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

export type VerifiedTransaction = {
  id: number;
  status: string; // success | failed | abandoned | ...
  reference: string;
  amount: number; // kobo
  currency: string;
};

export function paystack(cfg: PaystackConfig) {
  const base = (cfg.baseUrl ?? 'https://api.paystack.co').replace(/\/$/, '');
  const f = cfg.fetch ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await f(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.secretKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || json.status === false) {
      throw new PaystackError(json.message ?? `Paystack ${res.status}`, res.status, json);
    }
    return json.data as T;
  }

  return {
    initialize: (p: {
      email: string; amount: number; reference: string; callback_url: string;
      channels: string[]; metadata?: Record<string, unknown>;
    }) => call<{ authorization_url: string; access_code: string; reference: string }>(
      'POST', '/transaction/initialize', { ...p, currency: 'NGN' }),
    verify: (reference: string) =>
      call<VerifiedTransaction>('GET', `/transaction/verify/${encodeURIComponent(reference)}`),
    refund: (reference: string) => call<{ status: string }>('POST', '/refund', { transaction: reference }),
    listBanks: () =>
      call<{ name: string; code: string; active: boolean }[]>('GET', '/bank?country=nigeria&perPage=100'),
    resolveAccount: (accountNumber: string, bankCode: string) =>
      call<{ account_name: string; account_number: string }>(
        'GET', `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`),
    createRecipient: (p: { name: string; account_number: string; bank_code: string }) =>
      call<{ recipient_code: string }>('POST', '/transferrecipient', { type: 'nuban', currency: 'NGN', ...p }),
    transfer: (p: { amount: number; recipient: string; reference: string; reason: string }) =>
      call<{ transfer_code: string; status: string; reference: string }>(
        'POST', '/transfer', { source: 'balance', ...p }),
  };
}

export type PaystackClient = ReturnType<typeof paystack>;

/** Paystack signs the raw body with HMAC-SHA512 using the secret key (hex). */
export async function verifySignature(rawBody: string, signature: string | null, secretKey: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return diff === 0;
}
