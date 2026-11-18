import { DashboardNotFound } from "./not-found-view";

// Static build: Apache serves /404.html for unknown paths; this one placeholder satisfies `output: "export"`.
export function generateStaticParams() {
  return [{ "not-found": ["_"] }];
}

export default function Page() {
  return <DashboardNotFound />;
}
