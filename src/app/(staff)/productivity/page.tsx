import { requireRole } from "@/lib/auth/guards";

import { CalendarPanel } from "./_components/calendar-panel";
import { FocusCard } from "./_components/focus-card";
import { ProjectsSection } from "./_components/projects-section";
import { QuickActions } from "./_components/quick-actions";
import { QuoteCard } from "./_components/quote-card";
import { RecentNotesCard } from "./_components/recent-notes-card";
import { SummaryCards } from "./_components/summary-cards";
import { TasksSection } from "./_components/tasks-section";
import { WeeklySummaryCard } from "./_components/weekly-summary-card";

// Productivity is personal productivity (tasks, focus, notes) — not an IT Planner module. Guarded to
// CEO + Account Manager so it is not an unguarded pseudo-Planner surface.
export default async function Page() {
  await requireRole(["ceo", "account_manager"]);
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="lg:col-span-9">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl text-foreground leading-none tracking-tight">Good morning, Arham.</h1>
            <p className="text-lg text-muted-foreground leading-none">
              Let&apos;s make today productive and meaningful.
            </p>
          </div>
          <SummaryCards />
          <TasksSection />
          <ProjectsSection />
          <QuickActions />
          <QuoteCard />
        </div>
      </section>

      <section className="flex flex-col gap-6 lg:col-span-3">
        <CalendarPanel />
        <FocusCard />
        <RecentNotesCard />
        <WeeklySummaryCard />
      </section>
    </div>
  );
}
