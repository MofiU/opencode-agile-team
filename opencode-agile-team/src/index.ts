import type { Plugin } from '@opencode-ai/plugin';
import { agents } from './agents';
import { tools } from './tools';
import { PLUGIN_PREFIX } from './types';

export const AgileTeamPlugin: Plugin = async (_ctx) => {
  return {
    tool: tools,
    config: async (openCodeConfig: Record<string, unknown>) => {
      if (!openCodeConfig.agent) {
        openCodeConfig.agent = {};
      }

      const agentConfig = openCodeConfig.agent as Record<string, unknown>;
      for (const [name, agentDef] of Object.entries(agents)) {
        const existing = agentConfig[name] as Record<string, unknown> | undefined;
        if (existing) {
          agentConfig[name] = { ...agentDef, ...existing };
        } else {
          agentConfig[name] = { ...agentDef };
        }
      }

      if (!openCodeConfig.command) {
        openCodeConfig.command = {};
      }

      const commandConfig = openCodeConfig.command as Record<string, { description: string; agent: string }>;
      commandConfig.sprint = {
        description: 'Sprint management - create, list, update sprints',
        agent: `${PLUGIN_PREFIX}scrum-master`,
      };
      commandConfig.backlog = {
        description: 'Product backlog management - create and update items',
        agent: `${PLUGIN_PREFIX}product-owner`,
      };
      commandConfig.standup = {
        description: 'Daily standup - log and view daily updates',
        agent: `${PLUGIN_PREFIX}scrum-master`,
      };
      commandConfig.retro = {
        description: 'Sprint retrospective - review and improve processes',
        agent: `${PLUGIN_PREFIX}scrum-master`,
      };
      commandConfig.review = {
        description: 'Sprint review - demonstrate and evaluate increment',
        agent: `${PLUGIN_PREFIX}product-owner`,
      };
      commandConfig.plan = {
        description: 'Sprint planning - plan upcoming sprint work',
        agent: `${PLUGIN_PREFIX}scrum-master`,
      };
    },
  };
};

export default AgileTeamPlugin;
