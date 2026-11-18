import { FieldCasePage } from "./_components/field-case-page";

// Static build: one page under the placeholder id (see src/lib/routing/htaccess.ts).
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <FieldCasePage />;
}
