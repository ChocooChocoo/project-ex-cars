"use client";

import { ArrowUpDown, Plus, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ROADMAP_PRIORITIES,
  ROADMAP_QUARTERS,
  ROADMAP_STATUSES,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@/lib/validation/roadmap";

import { ROADMAP_PRIORITY_LABELS, ROADMAP_STATUS_LABELS } from "./roadmap-config";
import { ROADMAP_TEAMS, type RoadmapFilters as RoadmapFiltersState } from "./roadmap-types";

export type RoadmapSortKey = "quarter" | "priority" | "title";

interface RoadmapFiltersProps {
  query: string;
  filters: RoadmapFiltersState;
  sortKey: RoadmapSortKey;
  canWrite: boolean;
  onQueryChange: (query: string) => void;
  onFiltersChange: (filters: RoadmapFiltersState) => void;
  onSortKeyChange: (sort: RoadmapSortKey) => void;
  onCreate: () => void;
}

export function RoadmapFilters({
  query,
  filters,
  sortKey,
  canWrite,
  onQueryChange,
  onFiltersChange,
  onSortKeyChange,
  onCreate,
}: RoadmapFiltersProps) {
  function setFilter<K extends keyof RoadmapFiltersState>(key: K, value: RoadmapFiltersState[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const filterCount =
    (filters.status === "all" ? 0 : 1) +
    (filters.priority === "all" ? 0 : 1) +
    (filters.quarter === "all" ? 0 : 1) +
    (filters.team === "all" ? 0 : 1);

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
      <InputGroup className="min-w-0 sm:w-64 2xl:w-48">
        <InputGroupInput
          type="search"
          placeholder="Search roadmap"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            <SlidersHorizontal data-icon="inline-start" />
            Filter
            {filterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 font-semibold text-[10px] text-primary-foreground">
                {filterCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Status</span>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilter("status", value as RoadmapStatus | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ROADMAP_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ROADMAP_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Priority</span>
              <Select
                value={filters.priority}
                onValueChange={(value) => setFilter("priority", value as RoadmapPriority | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {ROADMAP_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {ROADMAP_PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Quarter</span>
              <Select value={filters.quarter} onValueChange={(value) => setFilter("quarter", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All quarters</SelectItem>
                  {ROADMAP_QUARTERS.map((quarter) => (
                    <SelectItem key={quarter} value={quarter}>
                      {quarter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Team</span>
              <Select value={filters.team} onValueChange={(value) => setFilter("team", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {ROADMAP_TEAMS.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            <ArrowUpDown data-icon="inline-start" />
            Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSortKeyChange("quarter")}>
            <span className={sortKey === "quarter" ? "font-semibold" : ""}>Chronological</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortKeyChange("priority")}>
            <span className={sortKey === "priority" ? "font-semibold" : ""}>Priority</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortKeyChange("title")}>
            <span className={sortKey === "title" ? "font-semibold" : ""}>Title</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite ? (
        <Button onClick={onCreate} className="w-full sm:w-auto">
          <Plus data-icon="inline-start" />
          Add item
        </Button>
      ) : null}
    </div>
  );
}
