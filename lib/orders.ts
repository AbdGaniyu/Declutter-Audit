export type OrderStatus =
  | 'awaiting_payment' | 'paid' | 'handed_over' | 'paid_out' | 'expired' | 'refunded' | 'disputed' | 'declined';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid · arrange pickup',
  handed_over: 'Collected',
  paid_out: 'Complete',
  expired: 'Payment window closed',
  refunded: 'Refunded',
  disputed: 'In dispute',
  declined: 'Offer declined',
};

export function statusLabel(s: string): string {
  return ORDER_STATUS_LABEL[s as OrderStatus] ?? s;
}
