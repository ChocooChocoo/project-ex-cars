import { ContractPaper } from "../../_components/paper-pages";

// Static build: one page under the placeholder id (see src/lib/routing/htaccess.ts).
export function generateStaticParams() {
  return [{ transactionId: "_" }];
}

export default function Page() {
  return <ContractPaper />;
}
