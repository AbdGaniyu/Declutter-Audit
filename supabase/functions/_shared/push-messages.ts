// Pure: turns a notification row into push text. Shared by the push function
// and unit tests (no Deno APIs here).

export type NotificationRow = { id: string; type: string; payload: Record<string, unknown> };
export type PushMessage = { title: string; body: string; url: string; tag: string };

export function naira(kobo: unknown): string {
  const n = typeof kobo === 'number' ? kobo : Number(kobo);
  if (!Number.isFinite(n)) return '';
  return '₦' + Math.round(n / 100).toLocaleString('en-NG');
}

function lagosTime(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)).replace(/\s/g, '').toLowerCase();
}

export function pushMessage(n: NotificationRow): PushMessage {
  const p = n.payload ?? {};
  const title = String(p.title ?? 'your lot');
  const lot = p.auction_id ? `/lot/${p.auction_id}` : '/me';
  const order = p.order_id ? `/me/orders/${p.order_id}` : '/me/orders';
  switch (n.type) {
    case 'outbid':
      return { title: "You've been outbid", body: `${title} is now ${naira(p.current_bid)}. Bid again before it closes.`, url: lot, tag: `lot-${p.auction_id}` };
    case 'won':
      return { title: 'You won!', body: `${title} for ${naira(p.amount)}. Pay by ${lagosTime(p.pay_by)} to keep it.`, url: order, tag: `order-${p.order_id}` };
    case 'second_chance':
      return { title: "It's yours if you want it", body: `${title} is offered to you at ${naira(p.amount)}. Pay by ${lagosTime(p.pay_by)}.`, url: order, tag: `order-${p.order_id}` };
    case 'sold':
      return { title: 'Your lot sold', body: `${title} sold for ${naira(p.amount)}. We'll tell you when the buyer pays.`, url: '/me/sales', tag: `sale-${p.order_id}` };
    case 'unsold':
      return { title: 'No bids this time', body: `${title} didn't sell. You can relist it in a later drop.`, url: '/me/sales', tag: `lot-${p.auction_id}` };
    case 'buyer_paid':
      return { title: 'Buyer has paid', body: `${title}: arrange pickup. Get the 6-digit code from the buyer at handover.`, url: '/me/sales', tag: `sale-${p.order_id}` };
    case 'payment_confirmed':
      return { title: 'Payment received', body: `${title}: show your handover code to the seller at pickup.`, url: order, tag: `order-${p.order_id}` };
    case 'payment_late_refunded':
      return { title: 'Payment refunded', body: `Your payment for ${title} arrived after the deadline, so it has been refunded.`, url: order, tag: `order-${p.order_id}` };
    case 'order_expired':
      return { title: 'Payment window closed', body: `You didn't pay for ${title} in time. This counts as a strike.`, url: order, tag: `order-${p.order_id}` };
    case 'buyer_defaulted':
      return { title: "Buyer didn't pay", body: `${title}: we've offered it to the next bidder.`, url: '/me/sales', tag: `sale-${p.auction_id}` };
    case 'suspended':
      return { title: 'Bidding paused', body: 'Your account has 2 strikes, so bidding is paused until our team reviews it.', url: '/me', tag: 'account' };
    case 'handed_over':
      return { title: 'Handover confirmed', body: `${title}: thanks! Your payout of ${naira(p.payout_amount)} is on the way.`, url: '/me/sales', tag: `sale-${p.order_id}` };
    case 'payout_sent':
      return { title: 'Payout sent', body: `${naira(p.amount)} for ${title} has been sent to your bank.`, url: '/me/sales', tag: `payout-${p.payout_id}` };
    case 'payout_failed':
      return { title: 'Payout problem', body: `We couldn't send ${naira(p.amount)} for ${title}. Check your bank details.`, url: '/me/bank', tag: `payout-${p.payout_id}` };
    case 'sale_fell_through':
      return { title: "Sale didn't complete", body: `${title} wasn't paid for. You can relist it in a later drop.`, url: '/me/sales', tag: `lot-${p.auction_id}` };
    case 'dispute_opened':
      return { title: 'A problem was reported', body: 'Our team will review the order and contact you. Payout is paused meanwhile.', url: '/me', tag: `order-${p.order_id}` };
    case 'dispute_resolved':
      return { title: 'Dispute resolved', body: p.resolution === 'refunded' ? 'The order was refunded to the buyer.' : 'The order was completed and the seller will be paid.', url: '/me', tag: `order-${p.order_id}` };
    case 'unsuspended':
      return { title: 'Bidding restored', body: 'Your account was reviewed and you can bid again. Please pay promptly when you win.', url: '/', tag: 'account' };
    default:
      return { title: 'Declutter', body: 'You have a new update.', url: '/me/notifications', tag: n.id };
  }
}
