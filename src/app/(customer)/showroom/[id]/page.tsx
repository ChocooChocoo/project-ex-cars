import { VehicleDetailPage } from "../_components/vehicle-detail-page";

// Static build: one page under the placeholder id; Apache serves it for every /showroom/<id>/ and the
// client component reads the real id from the URL (src/lib/routing/htaccess.ts).
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <VehicleDetailPage />;
}
