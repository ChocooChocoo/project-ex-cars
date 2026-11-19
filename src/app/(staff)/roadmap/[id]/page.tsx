import { RoadmapItemPage } from "../_components/roadmap-item-page";

// Static export: one shell for every roadmap item; the client reads the id from the URL.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <RoadmapItemPage />;
}
