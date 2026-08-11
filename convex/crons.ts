import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "archive-old-tasks",
  { hourUTC: 1, minuteUTC: 0 },
  api.tasks.archiveOldTasks,
);

export default crons;
