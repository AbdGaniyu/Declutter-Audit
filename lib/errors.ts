// Human copy for reasons returned by Postgres RPCs.
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Please sign in first.',
  not_verified: 'Verify your phone number to continue.',
  suspended: 'Bidding is paused on your account until it is reviewed.',
  invalid_amount: 'Enter a whole naira amount.',
  not_found: 'This lot could not be found.',
  cancelled: 'This lot was withdrawn by the seller.',
  not_started: "Bidding hasn't opened yet.",
  ended: 'Bidding has closed on this lot.',
  own_lot: "You can't bid on your own lot.",
  already_leading: "You're already the highest bidder.",
  too_low: 'Someone bid higher. Try the new minimum.',
  drop_not_found: 'That drop is not available.',
  drop_closed_for_listing: 'That drop has already opened. Pick a later one.',
  drop_full: 'That drop is full. Pick a later one.',
  seller_limit_reached: "You've listed the maximum number of lots in this drop.",
  invalid_price: 'Asking price must be at least ₦500, in whole naira.',
  not_editable: 'This lot can no longer be changed.',
  not_cancellable: 'Lots with bids cannot be withdrawn.',
  not_relistable: 'Only unsold lots can be relisted.',
  already_relisted: 'This lot has already been relisted.',
  too_many_photos: 'You can add up to 6 photos.',
  photo_not_found: 'Photo upload failed. Try again.',
  forbidden: "You don't have access to that.",
  wrong_code: "That code doesn't match. Check with the buyer.",
  locked: 'Too many wrong codes. Our team will contact you.',
  not_payable: 'This order can no longer be paid.',
  not_confirmable: 'This order is not ready for handover.',
  not_disputable: 'Only paid orders can be disputed.',
  reason_required: 'Tell us briefly what went wrong.',
  drop_already_open: 'That drop has already opened.',
  payment_provider_error: 'Payment provider is unavailable. Try again in a minute.',
  no_bank_account: 'Add your bank account to receive payouts.',
};

export function messageFor(reason: string | null | undefined): string {
  if (!reason) return 'Something went wrong. Try again.';
  return MESSAGES[reason] ?? 'Something went wrong. Try again.';
}

/** Extract our P0001 reason code from a Supabase/PostgREST error. */
export function reasonFromError(err: { message?: string; code?: string } | null): string | null {
  if (!err) return null;
  if (err.message && MESSAGES[err.message]) return err.message;
  return err.message ?? null;
}
