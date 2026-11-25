import { redirect } from 'next/navigation';

// Seller orders live under Orders › Selling (DESIGN.md › Key screens › Orders).
export default function SalesPage() {
  redirect('/me/orders?view=selling');
}
