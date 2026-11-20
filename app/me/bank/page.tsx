import { getServerSupabase } from '@/lib/supabase/server';
import { BankForm } from './BankForm';

export const dynamic = 'force-dynamic';

export default async function BankPage() {
  const supabase = await getServerSupabase();
  const { data: bank } = await supabase.from('seller_bank').select('bank_name, account_number, account_name').maybeSingle();
  return (
    <div className="mx-auto max-w-lot space-y-4">
      <div>
        <h1 className="font-display text-display">Payout bank account</h1>
        <p className="text-body text-ink-muted">We pay you here after the buyer gives you their handover code. Payouts are sent with Paystack.</p>
      </div>
      {bank && (
        <div className="rounded-card bg-surface p-4 shadow-elev">
          <p className="text-label uppercase text-ink-muted">Current account</p>
          <p className="font-semibold">{bank.account_name}</p>
          <p className="text-body text-ink-muted">{bank.bank_name ?? 'Bank'} · ••••{bank.account_number.slice(-4)}</p>
        </div>
      )}
      <BankForm hasBank={Boolean(bank)} />
    </div>
  );
}
