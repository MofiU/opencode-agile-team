import type { Plugin } from "@opencode-ai/plugin";
import { sprintTool } from "./tools/sprint.js";
import { backlogTool } from "./tools/backlog.js";
import { standupTool } from "./tools/standup.js";
import { retroTool } from "./tools/retro.js";
import { reviewTool } from "./tools/review.js";
import { metricsTool } from "./tools/metrics.js";

export const agileTeamPlugin: Plugin = async (ctx) => {
  return {
    tools: {
      sprint: sprintTool,
      backlog: backlogTool,
      standup: standupTool,
      retro: retroTool,
      review: reviewTool,
      metrics: metricsTool,
    },
  };
};

export { sprintTool, backlogTool, standupTool, retroTool, reviewTool, metricsTool };
