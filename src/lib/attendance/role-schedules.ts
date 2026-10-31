import schedules from "./role-schedules.json";

// JSON is shared with the CommonJS seed script without requiring a TypeScript runtime.
export const ROLE_WORK_SCHEDULES: Readonly<Partial<Record<string, (typeof schedules)[keyof typeof schedules]>>> =
  schedules;
