import { StaffTransactionDetailPage } from "./_components/staff-transaction-detail-page";

// Static build: one page under the placeholder id (see src/lib/routing/htaccess.ts).
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function TransactionDetailPage() {
  return <StaffTransactionDetailPage />;
}
