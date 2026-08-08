import type { RoadmapItem } from "./roadmap-types";

export interface RoadmapNode {
  item: RoadmapItem;
  children: RoadmapNode[];
}

export function buildRoadmapTree(items: RoadmapItem[]): RoadmapNode[] {
  const byId = new Map<string, RoadmapNode>();
  for (const item of items) {
    byId.set(item.id, { item, children: [] });
  }

  const roots: RoadmapNode[] = [];
  for (const node of byId.values()) {
    const parent = node.item.parent_id ? byId.get(node.item.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function getQuarterKey(item: RoadmapItem): string {
  return item.year && item.quarter ? `${item.quarter}-${item.year}` : "unscheduled";
}

export function sortQuarterKeys(keys: string[]): string[] {
  const order: Record<string, number> = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
  return [...keys].sort((a, b) => {
    if (a === "unscheduled") return 1;
    if (b === "unscheduled") return -1;
    const [qa, ya] = a.split("-");
    const [qb, yb] = b.split("-");
    if (ya !== yb) return Number(ya) - Number(yb);
    return order[qa] - order[qb];
  });
}

export function computeProgress(node: RoadmapNode): number {
  const features: RoadmapItem[] = [];
  const walk = (current: RoadmapNode) => {
    if (current.item.kind === "feature") features.push(current.item);
    current.children.forEach(walk);
  };
  walk(node);

  if (features.length === 0) {
    const statusProgress: Record<string, number> = { planned: 0, on_hold: 25, in_progress: 50, completed: 100 };
    return statusProgress[node.item.status] ?? 0;
  }

  const completed = features.filter((feature) => feature.status === "completed").length;
  return Math.round((completed / features.length) * 100);
}

export function matchesFilters(
  item: RoadmapItem,
  query: string,
  status: string,
  priority: string,
  quarter: string,
  team: string,
): boolean {
  if (
    query &&
    !item.title.toLowerCase().includes(query.toLowerCase()) &&
    !(item.description ?? "").toLowerCase().includes(query.toLowerCase())
  ) {
    return false;
  }
  if (status !== "all" && item.status !== status) return false;
  if (priority !== "all" && item.priority !== priority) return false;
  if (quarter !== "all" && getQuarterKey(item) !== quarter) return false;
  if (team !== "all" && item.team !== team) return false;
  return true;
}
