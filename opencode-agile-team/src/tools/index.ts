import { tool } from '@opencode-ai/plugin';
import type { Sprint, BacklogItem, DailyStandup, Retrospective, SprintReview, Blockers, BacklogItemStatus } from '../types';
import {
  defaultConfig,
  createSprintGoal,
  calculateTeamCapacity,
  validateConfig,
} from '../config/defaults';

interface ToolContext {
  directory: string;
  worktree?: string;
  sessionID?: string;
}

let sprintStore: Sprint[] = [];
let backlogStore: BacklogItem[] = [];
let standupStore: DailyStandup[] = [];
let retroStore: Retrospective[] = [];
let reviewStore: SprintReview[] = [];
let blockerStore: Blockers[] = [];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const tools = {
  sprint_create: tool({
    description: 'Create a new sprint with goal and backlog items',
    args: {
      name: tool.schema.string(),
      goal: tool.schema.string(),
      startDate: tool.schema.string(),
      durationWeeks: tool.schema.number().optional(),
      backlogItemIds: tool.schema.array(tool.schema.string()).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const durationWeeks = args.durationWeeks ?? defaultConfig.defaultSprintDurationWeeks;
      const startDate = new Date(args.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationWeeks * 7);

      const sprint: Sprint = {
        id: generateId('sprint'),
        name: args.name,
        startDate,
        endDate,
        goal: {
          id: generateId('goal'),
          goal: createSprintGoal(args.goal),
          achieved: false,
        },
        backlogItemIds: args.backlogItemIds ?? [],
        carryOverItems: [],
        capacity: calculateTeamCapacity(defaultConfig.teamMembers, durationWeeks),
        velocity: 0,
        status: 'planned',
        createdAt: new Date(),
      };

      sprintStore.push(sprint);
      return JSON.stringify({
        success: true,
        sprint: {
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal.goal,
          startDate: sprint.startDate.toISOString(),
          endDate: sprint.endDate.toISOString(),
          durationWeeks,
          status: sprint.status,
        },
      });
    },
  }),

  sprint_list: tool({
    description: 'List all sprints with optional status filter',
    args: {
      status: tool.schema.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      let sprints = sprintStore;
      if (args.status) {
        sprints = sprints.filter((s) => s.status === args.status);
      }
      return JSON.stringify({
        sprints: sprints.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          startDate: s.startDate.toISOString(),
          endDate: s.endDate.toISOString(),
          velocity: s.velocity,
        })),
      });
    },
  }),

  sprint_update: tool({
    description: 'Update sprint status or details',
    args: {
      id: tool.schema.string(),
      status: tool.schema.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
      goalAchieved: tool.schema.boolean().optional(),
      achievementNotes: tool.schema.string().optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const sprint = sprintStore.find((s) => s.id === args.id);
      if (!sprint) {
        return JSON.stringify({ success: false, error: `Sprint ${args.id} not found` });
      }

      if (args.status) {
        sprint.status = args.status;
      }
      if (args.goalAchieved !== undefined) {
        sprint.goal.achieved = args.goalAchieved;
        sprint.goal.achievementNotes = args.achievementNotes;
      }

      return JSON.stringify({ success: true, sprint });
    },
  }),

  backlog_item_create: tool({
    description: 'Create a new backlog item (user story, bug, task)',
    args: {
      title: tool.schema.string(),
      description: tool.schema.string(),
      priority: tool.schema.enum(['P1', 'P2', 'P3', 'P4']),
      storyPoints: tool.schema.number().optional(),
      acceptanceCriteria: tool.schema.array(tool.schema.string()).optional(),
      labels: tool.schema.array(tool.schema.string()).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const item: BacklogItem = {
        id: generateId(args.title.toLowerCase().replace(/\s+/g, '-').substring(0, 10)),
        title: args.title,
        description: args.description,
        priority: args.priority,
        storyPoints: args.storyPoints ?? null,
        status: BacklogItemStatus.Backlog,
        acceptanceCriteria: args.acceptanceCriteria ?? [],
        labels: args.labels ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      backlogStore.push(item);
      return JSON.stringify({ success: true, item });
    },
  }),

  backlog_item_update: tool({
    description: 'Update a backlog item status or details',
    args: {
      id: tool.schema.string(),
      status: tool.schema.enum(['backlog', 'ready', 'in-progress', 'in-review', 'done', 'removed']).optional(),
      priority: tool.schema.enum(['P1', 'P2', 'P3', 'P4']).optional(),
      assignee: tool.schema.string().optional(),
      storyPoints: tool.schema.number().optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const item = backlogStore.find((i) => i.id === args.id);
      if (!item) {
        return JSON.stringify({ success: false, error: `Backlog item ${args.id} not found` });
      }

      if (args.status) {
        item.status = args.status;
        if (args.status === 'done') {
          item.completedAt = new Date();
        }
      }
      if (args.priority) {
        item.priority = args.priority;
      }
      if (args.assignee !== undefined) {
        item.assignee = args.assignee;
      }
      if (args.storyPoints !== undefined) {
        item.storyPoints = args.storyPoints;
      }
      item.updatedAt = new Date();

      return JSON.stringify({ success: true, item });
    },
  }),

  backlog_item_list: tool({
    description: 'List backlog items with optional filters',
    args: {
      status: tool.schema.enum(['backlog', 'ready', 'in-progress', 'in-review', 'done']).optional(),
      priority: tool.schema.enum(['P1', 'P2', 'P3', 'P4']).optional(),
      sprintId: tool.schema.string().optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      let items = backlogStore;
      if (args.status) {
        items = items.filter((i) => i.status === args.status);
      }
      if (args.priority) {
        items = items.filter((i) => i.priority === args.priority);
      }
      if (args.sprintId) {
        const sprint = sprintStore.find((s) => s.id === args.sprintId);
        if (sprint) {
          items = items.filter((i) => sprint.backlogItemIds.includes(i.id));
        }
      }
      return JSON.stringify({ items });
    },
  }),

  standup_create: tool({
    description: 'Create a daily standup meeting record',
    args: {
      sprintId: tool.schema.string(),
      entries: tool.schema.array(tool.schema.object({
        memberId: tool.schema.string(),
        yesterday: tool.schema.string(),
        today: tool.schema.string(),
        blockers: tool.schema.array(tool.schema.string()),
        notes: tool.schema.string().optional(),
      })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const standup: DailyStandup = {
        id: generateId('standup'),
        date: new Date(),
        sprintId: args.sprintId,
        entries: args.entries.map((e: { memberId: string; yesterday: string; today: string; blockers: string[]; notes?: string }) => ({
          memberId: e.memberId,
          yesterday: e.yesterday,
          today: e.today,
          blockers: e.blockers,
          notes: e.notes,
        })),
        impediments: args.entries.flatMap((e: { blockers: string[] }) => e.blockers),
        duration: 15,
      };

      standupStore.push(standup);

      const blockers = args.entries
        .filter((e: { blockers: string[] }) => e.blockers.length > 0)
        .map((e: { blockers: string[] }) => e.blockers)
        .flat();

      return JSON.stringify({
        success: true,
        standup: {
          id: standup.id,
          date: standup.date.toISOString(),
          sprintId: standup.sprintId,
          entryCount: standup.entries.length,
          impediments: standup.impediments,
        },
        blockersRaised: blockers.length,
      });
    },
  }),

  standup_list: tool({
    description: 'List standup meetings for a sprint',
    args: {
      sprintId: tool.schema.string(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const standups = standupStore.filter((s) => s.sprintId === args.sprintId);
      return JSON.stringify({
        standups: standups.map((s) => ({
          id: s.id,
          date: s.date.toISOString(),
          entryCount: s.entries.length,
          impediments: s.impediments,
        })),
      });
    },
  }),

  retro_create: tool({
    description: 'Create a sprint retrospective',
    args: {
      sprintId: tool.schema.string(),
      format: tool.schema.enum(['start-stop-continue', 'mad-sad-glad', 'four-ls', 'sailboat', 'starfish', 'flower']),
      feedback: tool.schema.array(tool.schema.object({
        category: tool.schema.string(),
        content: tool.schema.string(),
        author: tool.schema.string().optional(),
      })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const retro: Retrospective = {
        id: generateId('retro'),
        sprintId: args.sprintId,
        format: args.format,
        feedback: args.feedback.map((f: { category: string; content: string; author?: string }) => ({
          id: generateId('feedback'),
          category: f.category,
          content: f.content,
          author: f.author,
          actioned: false,
        })),
        actionItems: [],
        heldAt: new Date(),
        participants: [],
      };

      retroStore.push(retro);
      return JSON.stringify({
        success: true,
        retro: {
          id: retro.id,
          sprintId: retro.sprintId,
          format: retro.format,
          feedbackCount: retro.feedback.length,
        },
      });
    },
  }),

  retro_add_feedback: tool({
    description: 'Add feedback to an existing retrospective',
    args: {
      retroId: tool.schema.string(),
      category: tool.schema.string(),
      content: tool.schema.string(),
      author: tool.schema.string().optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const retro = retroStore.find((r) => r.id === args.retroId);
      if (!retro) {
        return JSON.stringify({ success: false, error: `Retrospective ${args.retroId} not found` });
      }

      retro.feedback.push({
        id: generateId('feedback'),
        category: args.category,
        content: args.content,
        author: args.author,
        actioned: false,
      });

      return JSON.stringify({ success: true, feedbackCount: retro.feedback.length });
    },
  }),

  review_create: tool({
    description: 'Create a sprint review meeting record',
    args: {
      sprintId: tool.schema.string(),
      completedItemIds: tool.schema.array(tool.schema.string()),
      incompleteItemIds: tool.schema.array(tool.schema.string()),
      stakeholderFeedback: tool.schema.array(tool.schema.string()).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const review: SprintReview = {
        id: generateId('review'),
        sprintId: args.sprintId,
        incrementDescription: 'Sprint increment',
        completedItems: backlogStore.filter((i) => args.completedItemIds.includes(i.id)),
        incompleteItems: backlogStore.filter((i) => args.incompleteItemIds.includes(i.id)),
        stakeholderFeedback: args.stakeholderFeedback ?? [],
        heldAt: new Date(),
        participants: [],
      };

      reviewStore.push(review);
      return JSON.stringify({
        success: true,
        review: {
          id: review.id,
          sprintId: review.sprintId,
          completedCount: review.completedItems.length,
          incompleteCount: review.incompleteItems.length,
        },
      });
    },
  }),

  blocker_create: tool({
    description: 'Log a blocker or impediment',
    args: {
      description: tool.schema.string(),
      impact: tool.schema.enum(['critical', 'high', 'medium', 'low']),
      blockedMembers: tool.schema.array(tool.schema.string()),
      affectedItems: tool.schema.array(tool.schema.string()).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const blocker: Blockers = {
        id: generateId('blocker'),
        description: args.description,
        impact: args.impact,
        blockedMembers: args.blockedMembers,
        identifiedAt: new Date(),
        affectedItems: args.affectedItems ?? [],
      };

      blockerStore.push(blocker);
      return JSON.stringify({
        success: true,
        blocker: {
          id: blocker.id,
          description: blocker.description,
          impact: blocker.impact,
          identifiedAt: blocker.identifiedAt.toISOString(),
        },
      });
    },
  }),

  blocker_resolve: tool({
    description: 'Mark a blocker as resolved',
    args: {
      id: tool.schema.string(),
      resolution: tool.schema.string(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const blocker = blockerStore.find((b) => b.id === args.id);
      if (!blocker) {
        return JSON.stringify({ success: false, error: `Blocker ${args.id} not found` });
      }

      blocker.resolvedAt = new Date();
      blocker.resolution = args.resolution;

      return JSON.stringify({ success: true, blocker });
    },
  }),

  blocker_list: tool({
    description: 'List blockers with optional status filter',
    args: {
      status: tool.schema.enum(['active', 'resolved']).optional(),
      impact: tool.schema.enum(['critical', 'high', 'medium', 'low']).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      let blockers = blockerStore;
      if (args.status === 'active') {
        blockers = blockers.filter((b) => !b.resolvedAt);
      } else if (args.status === 'resolved') {
        blockers = blockers.filter((b) => b.resolvedAt);
      }
      if (args.impact) {
        blockers = blockers.filter((b) => b.impact === args.impact);
      }
      return JSON.stringify({ blockers });
    },
  }),

  config_validate: tool({
    description: 'Validate agile plugin configuration',
    args: {
      config: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const configToValidate = args.config ?? defaultConfig;
      const result = validateConfig(configToValidate as typeof defaultConfig);
      return JSON.stringify(result);
    },
  }),

  team_capacity: tool({
    description: 'Calculate team capacity for a sprint',
    args: {
      durationWeeks: tool.schema.number().optional(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(args: any, _context: ToolContext) {
      const durationWeeks = args.durationWeeks ?? defaultConfig.defaultSprintDurationWeeks;
      const capacity = calculateTeamCapacity(defaultConfig.teamMembers, durationWeeks);
      return JSON.stringify({
        capacity,
        durationWeeks,
        teamSize: defaultConfig.teamMembers.length,
        workingDays: durationWeeks * defaultConfig.workingDaysPerWeek,
      });
    },
  }),
};

export default tools;
