"use client";

import { useRouter } from "next/navigation";

import {
  BarChart3,
  ClipboardCheck,
  Code,
  Globe,
  type LucideIcon,
  Orbit,
  Package,
  Palette,
  Pencil,
  Plus,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { ProjectCardData } from "./roadmap-dashboard-data";

interface RoadmapProjectsSectionProps {
  projects: ProjectCardData[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  canWrite: boolean;
}

const TEAM_ICONS: Record<string, LucideIcon> = {
  Platform: Orbit,
  Backend: Code,
  Frontend: Globe,
  Mobile: ClipboardCheck,
  Data: BarChart3,
  Design: Palette,
  Product: Package,
  QA: Shield,
  Security: Wrench,
};

export function RoadmapProjectsSection({ projects, onSelect, onCreate, canWrite }: RoadmapProjectsSectionProps) {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl tracking-tight">Initiatives</h2>
        <div className="flex items-center gap-2">
          <Select defaultValue="active">
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Active" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {canWrite ? (
            <Button variant="outline" onClick={onCreate}>
              <Plus data-icon="inline-start" />
              New
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {projects.map((project) => (
          <button
            type="button"
            key={project.id}
            onClick={() => onSelect(project.id)}
            className="group cursor-pointer text-left"
          >
            <Card className="shadow-xs transition-shadow group-hover:ring-2 group-hover:ring-primary/20">
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = TEAM_ICONS[project.team] ?? Settings;
                      return <Icon className="size-4 text-muted-foreground" />;
                    })()}
                    <span>{project.title}</span>
                  </div>
                </CardTitle>
                <CardAction className="flex items-center gap-1.5">
                  <Badge variant="outline">{project.status}</Badge>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/roadmap/${project.id}?edit=true`);
                      }}
                      className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Edit ${project.title}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1">
                  <div className="text-sm leading-none">{project.description}</div>
                  <div className="flex items-center gap-3">
                    <Progress value={project.progress} className="h-2" />
                    <span className="shrink-0 text-sm">{project.progress}%</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="py-2.5">
                <span className="text-muted-foreground">{project.due}</span>
              </CardFooter>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
