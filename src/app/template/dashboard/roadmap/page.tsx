import { sampleRoadmapItems } from "./_components/data";
import { RoadmapTimeline } from "./_components/roadmap-timeline";

export default function Page() {
  return (
    <div data-content-padding="false">
      <RoadmapTimeline initialItems={sampleRoadmapItems} canWrite />
    </div>
  );
}
