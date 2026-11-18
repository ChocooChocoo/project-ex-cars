import { TransactionDetailPage } from "../_components/transaction-detail-page";

// Static build: one page under the placeholder id (see src/lib/routing/htaccess.ts).
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function MyTransactionDetailPage() {
  return <TransactionDetailPage />;
}
