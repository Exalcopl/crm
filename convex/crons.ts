import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "archive-old-tasks",
  { hourUTC: 1, minuteUTC: 0 },
  api.tasks.archiveOldTasks,
);

crons.interval(
  "check-task-deadlines",
  { hours: 1 },
  internal.notificationsCron.checkTaskDeadlines,
);

export default crons;

