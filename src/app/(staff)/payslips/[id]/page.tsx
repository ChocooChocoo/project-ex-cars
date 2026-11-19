import { PayslipDetailPage } from "./_components/payslip-detail-page";

// Static export: one shell for every payslip id; the client reads the id from the URL.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <PayslipDetailPage />;
}
