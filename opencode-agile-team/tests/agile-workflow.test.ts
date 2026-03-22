/**
 * OpenCode Agile Team Plugin - Integration Tests
 * 
 * Tests the complete agile workflow:
 * 1. Sprint creation and management
 * 2. Backlog item lifecycle
 * 3. Daily standup operations
 * 4. Sprint retrospective
 * 5. Sprint review
 * 6. Blocker management
 * 7. Team capacity calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tools } from '../src/tools';
import type { ToolContext } from '../src/tools';

// Mock context for testing
const mockContext: ToolContext = {
  directory: '/tmp/agile-test',
  worktree: undefined,
  sessionID: 'test-session',
};

// Helper function to execute tools
async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = tools[toolName as keyof typeof tools];
  if (!tool) {
    throw new Error(`Tool ${toolName} not found`);
  }
  const result = await tool.execute(args, mockContext);
  return JSON.parse(result as string);
}

describe('Sprint Management', () => {
  it('should create a new sprint', async () => {
    const result = await executeTool('sprint_create', {
      name: 'Sprint 1',
      goal: 'Complete user authentication',
      startDate: '2026-03-23',
      durationWeeks: 2,
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('sprint');
    expect((result as { sprint: { name: string; status: string } }).sprint.name).toBe('Sprint 1');
    expect((result as { sprint: { status: string } }).sprint.status).toBe('planned');
  });

  it('should list all sprints', async () => {
    // Create a sprint first
    await executeTool('sprint_create', {
      name: 'Sprint List Test',
      goal: 'Test sprint listing',
      startDate: '2026-03-23',
    });

    const result = await executeTool('sprint_list', {});

    expect(result).toHaveProperty('sprints');
    expect(Array.isArray((result as { sprints: unknown[] }).sprints)).toBe(true);
  });

  it('should update sprint status', async () => {
    // Create a sprint
    const createResult = await executeTool('sprint_create', {
      name: 'Sprint Update Test',
      goal: 'Test sprint update',
      startDate: '2026-03-23',
    }) as { sprint: { id: string } };

    const sprintId = createResult.sprint.id;

    // Update to active
    const updateResult = await executeTool('sprint_update', {
      id: sprintId,
      status: 'active',
    });

    expect(updateResult).toHaveProperty('success', true);
    expect((updateResult as { sprint: { status: string } }).sprint.status).toBe('active');
  });
});

describe('Backlog Management', () => {
  it('should create a backlog item', async () => {
    const result = await executeTool('backlog_item_create', {
      title: 'User Login',
      description: 'As a user, I want to login so that I can access my account',
      priority: 'P1',
      storyPoints: 5,
      acceptanceCriteria: [
        'User can enter email and password',
        'System validates credentials',
        'User receives error for invalid credentials',
      ],
      labels: ['auth', 'security'],
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('item');
    expect((result as { item: { title: string; priority: string } }).item.title).toBe('User Login');
    expect((result as { item: { priority: string } }).item.priority).toBe('P1');
  });

  it('should create backlog items with different priorities', async () => {
    const priorities = ['P1', 'P2', 'P3', 'P4'];
    const createdItems: string[] = [];

    for (const priority of priorities) {
      const result = await executeTool('backlog_item_create', {
        title: `Task ${priority}`,
        description: `Description for ${priority}`,
        priority,
        storyPoints: priorities.indexOf(priority) + 1,
      });
      createdItems.push((result as { item: { id: string } }).item.id);
    }

    expect(createdItems).toHaveLength(4);

    // List items and verify all are present
    const listResult = await executeTool('backlog_item_list', {});
    const items = (listResult as { items: { id: string }[] }).items;
    
    for (const id of createdItems) {
      expect(items.some((item) => item.id === id)).toBe(true);
    }
  });

  it('should update backlog item status', async () => {
    // Create an item
    const createResult = await executeTool('backlog_item_create', {
      title: 'Status Update Test',
      description: 'Testing status updates',
      priority: 'P2',
    }) as { item: { id: string } };

    const itemId = createResult.item.id;

    // Update status to in-progress
    const updateResult = await executeTool('backlog_item_update', {
      id: itemId,
      status: 'in-progress',
    });

    expect(updateResult).toHaveProperty('success', true);

    // Update to done
    const doneResult = await executeTool('backlog_item_update', {
      id: itemId,
      status: 'done',
    });

    expect(doneResult).toHaveProperty('success', true);
    expect((doneResult as { item: { completedAt: Date } }).item).toHaveProperty('completedAt');
  });

  it('should filter backlog items by status', async () => {
    // Create items with different statuses
    const item1 = await executeTool('backlog_item_create', {
      title: 'Done Item',
      description: 'This is done',
      priority: 'P1',
    }) as { item: { id: string } };

    const item2 = await executeTool('backlog_item_create', {
      title: 'Backlog Item',
      description: 'This is in backlog',
      priority: 'P2',
    }) as { item: { id: string } };

    // Update first item to done
    await executeTool('backlog_item_update', {
      id: item1.item.id,
      status: 'done',
    });

    // Filter by done status
    const doneResult = await executeTool('backlog_item_list', { status: 'done' });
    const doneItems = (doneResult as { items: { id: string }[] }).items;
    expect(doneItems.some((i) => i.id === item1.item.id)).toBe(true);
    expect(doneItems.some((i) => i.id === item2.item.id)).toBe(false);

    // Filter by backlog status
    const backlogResult = await executeTool('backlog_item_list', { status: 'backlog' });
    const backlogItems = (backlogResult as { items: { id: string }[] }).items;
    expect(backlogItems.some((i) => i.id === item2.item.id)).toBe(true);
  });
});

describe('Daily Standup', () => {
  it('should create a standup meeting', async () => {
    // First create a sprint
    const sprintResult = await executeTool('sprint_create', {
      name: 'Standup Test Sprint',
      goal: 'Testing standups',
      startDate: '2026-03-23',
    }) as { sprint: { id: string } };

    const sprintId = sprintResult.sprint.id;

    const result = await executeTool('standup_create', {
      sprintId,
      entries: [
        {
          memberId: 'member-1',
          yesterday: 'Completed login page',
          today: 'Working on dashboard',
          blockers: [],
        },
        {
          memberId: 'member-2',
          yesterday: 'Set up CI/CD pipeline',
          today: 'Writing tests',
          blockers: ['Need access to staging environment'],
        },
      ],
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('standup');
    expect((result as { standup: { entryCount: number } }).standup.entryCount).toBe(2);
    expect((result as { blockersRaised: number }).blockersRaised).toBe(1);
  });

  it('should list standups for a sprint', async () => {
    // Create sprint and standup
    const sprintResult = await executeTool('sprint_create', {
      name: 'Standup List Test',
      goal: 'Testing standup listing',
      startDate: '2026-03-23',
    }) as { sprint: { id: string } };

    const sprintId = sprintResult.sprint.id;

    await executeTool('standup_create', {
      sprintId,
      entries: [
        {
          memberId: 'member-1',
          yesterday: 'Work 1',
          today: 'Work 2',
          blockers: [],
        },
      ],
    });

    const result = await executeTool('standup_list', { sprintId });

    expect(result).toHaveProperty('standups');
    expect(Array.isArray((result as { standups: unknown[] }).standups)).toBe(true);
    expect((result as { standups: unknown[] }).standups.length).toBeGreaterThan(0);
  });
});

describe('Sprint Retrospective', () => {
  it('should create a retrospective', async () => {
    // Create sprint
    const sprintResult = await executeTool('sprint_create', {
      name: 'Retro Test Sprint',
      goal: 'Testing retrospectives',
      startDate: '2026-03-23',
    }) as { sprint: { id: string } };

    const sprintId = sprintResult.sprint.id;

    const result = await executeTool('retro_create', {
      sprintId,
      format: 'start-stop-continue',
      feedback: [
        {
          category: 'start',
          content: 'Daily standups are helping us stay aligned',
          author: 'member-1',
        },
        {
          category: 'stop',
          content: 'Long meetings that could be emails',
          author: 'member-2',
        },
        {
          category: 'continue',
          content: 'Pair programming sessions',
          author: 'member-3',
        },
      ],
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('retro');
    expect((result as { retro: { feedbackCount: number } }).retro.feedbackCount).toBe(3);
  });

  it('should add feedback to existing retrospective', async () => {
    // Create sprint and retro
    const sprintResult = await executeTool('sprint_create', {
      name: 'Retro Feedback Test',
      goal: 'Testing retro feedback',
      startDate: '2026-03-23',
    }) as { sprint: { id: string } };

    const sprintId = sprintResult.sprint.id;

    const retroResult = await executeTool('retro_create', {
      sprintId,
      format: 'four-ls',
      feedback: [
        {
          category: 'liked',
          content: 'Good communication',
        },
      ],
    }) as { retro: { id: string } };

    const retroId = retroResult.retro.id;

    // Add more feedback
    const addResult = await executeTool('retro_add_feedback', {
      retroId,
      category: 'learned',
      content: 'Learned new testing frameworks',
      author: 'member-1',
    });

    expect(addResult).toHaveProperty('success', true);
    expect((addResult as { feedbackCount: number }).feedbackCount).toBe(2);
  });
});

describe('Sprint Review', () => {
  it('should create a sprint review', async () => {
    // Create sprint
    const sprintResult = await executeTool('sprint_create', {
      name: 'Review Test Sprint',
      goal: 'Testing sprint review',
      startDate: '2026-03-23',
    }) as { sprint: { id: string } };

    const sprintId = sprintResult.sprint.id;

    // Create some backlog items
    const item1 = await executeTool('backlog_item_create', {
      title: 'Completed Item',
      description: 'This was completed',
      priority: 'P1',
    }) as { item: { id: string } };

    const item2 = await executeTool('backlog_item_create', {
      title: 'Incomplete Item',
      description: 'This was not completed',
      priority: 'P2',
    }) as { item: { id: string } };

    const result = await executeTool('review_create', {
      sprintId,
      completedItemIds: [item1.item.id],
      incompleteItemIds: [item2.item.id],
      stakeholderFeedback: [
        'Great progress on authentication',
        'Need better error messages',
      ],
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('review');
    expect((result as { review: { completedCount: number; incompleteCount: number } }).review.completedCount).toBe(1);
    expect((result as { review: { incompleteCount: number } }).review.incompleteCount).toBe(1);
  });
});

describe('Blocker Management', () => {
  it('should create a blocker', async () => {
    const result = await executeTool('blocker_create', {
      description: 'Staging environment is down',
      impact: 'critical',
      blockedMembers: ['member-1', 'member-2'],
      affectedItems: ['US-001'],
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('blocker');
    expect((result as { blocker: { impact: string } }).blocker.impact).toBe('critical');
  });

  it('should resolve a blocker', async () => {
    // Create blocker
    const createResult = await executeTool('blocker_create', {
      description: 'Test blocker',
      impact: 'high',
      blockedMembers: ['member-1'],
    }) as { blocker: { id: string } };

    const blockerId = createResult.blocker.id;

    // Resolve blocker
    const resolveResult = await executeTool('blocker_resolve', {
      id: blockerId,
      resolution: 'Environment has been restored',
    });

    expect(resolveResult).toHaveProperty('success', true);
    expect(resolveResult).toHaveProperty('blocker');
    expect((resolveResult as { blocker: { resolution: string } }).blocker).toHaveProperty('resolution');
  });

  it('should filter blockers by status', async () => {
    // Create and resolve a blocker
    const createResult = await executeTool('blocker_create', {
      description: 'Filter test blocker',
      impact: 'medium',
      blockedMembers: ['member-1'],
    }) as { blocker: { id: string } };

    await executeTool('blocker_resolve', {
      id: createResult.blocker.id,
      resolution: 'Resolved',
    });

    // Filter active blockers
    const activeResult = await executeTool('blocker_list', { status: 'active' });
    const activeBlockers = (activeResult as { blockers: { id: string }[] }).blockers;
    expect(activeBlockers.some((b) => b.id === createResult.blocker.id)).toBe(false);

    // Filter resolved blockers
    const resolvedResult = await executeTool('blocker_list', { status: 'resolved' });
    const resolvedBlockers = (resolvedResult as { blockers: { id: string }[] }).blockers;
    expect(resolvedBlockers.some((b) => b.id === createResult.blocker.id)).toBe(true);
  });

  it('should filter blockers by impact level', async () => {
    // Create blockers with different impacts
    await executeTool('blocker_create', {
      description: 'Critical issue',
      impact: 'critical',
      blockedMembers: ['member-1'],
    });

    await executeTool('blocker_create', {
      description: 'Low issue',
      impact: 'low',
      blockedMembers: ['member-2'],
    });

    // Filter critical blockers
    const criticalResult = await executeTool('blocker_list', { impact: 'critical' });
    const criticalBlockers = (criticalResult as { blockers: { impact: string }[] }).blockers;
    expect(criticalBlockers.every((b) => b.impact === 'critical')).toBe(true);
  });
});

describe('Team Capacity', () => {
  it('should calculate team capacity', async () => {
    const result = await executeTool('team_capacity', {
      durationWeeks: 2,
    });

    expect(result).toHaveProperty('capacity');
    expect(result).toHaveProperty('durationWeeks', 2);
    expect(result).toHaveProperty('teamSize');
    expect(result).toHaveProperty('workingDays');
  });

  it('should use default duration when not specified', async () => {
    const result = await executeTool('team_capacity', {});

    expect(result).toHaveProperty('durationWeeks', 2); // Default
  });
});

describe('Configuration Validation', () => {
  it('should validate default configuration', async () => {
    const result = await executeTool('config_validate', {});

    expect(result).toHaveProperty('valid', true);
    expect(result).toHaveProperty('errors');
    expect((result as { errors: unknown[] }).errors).toHaveLength(0);
  });

  it('should reject invalid sprint duration', async () => {
    const result = await executeTool('config_validate', {
      config: {
        defaultSprintDurationWeeks: 5, // Invalid: > 4 weeks
      },
    });

    expect(result).toHaveProperty('valid', false);
    expect((result as { errors: string[] }).errors).toContain('Sprint duration must be between 1 and 4 weeks');
  });
});

describe('Complete Sprint Workflow', () => {
  it('should execute a complete sprint lifecycle', async () => {
    // Step 1: Create Sprint
    const sprintResult = await executeTool('sprint_create', {
      name: 'Complete Workflow Sprint',
      goal: 'Complete user management feature',
      startDate: '2026-03-23',
      durationWeeks: 2,
    }) as { sprint: { id: string } };

    const sprintId = sprintResult.sprint.id;
    expect(sprintResult).toHaveProperty('success', true);

    // Step 2: Create Backlog Items
    const userStory1 = await executeTool('backlog_item_create', {
      title: 'User Registration',
      description: 'As a visitor, I want to register an account',
      priority: 'P1',
      storyPoints: 8,
    }) as { item: { id: string } };

    const userStory2 = await executeTool('backlog_item_create', {
      title: 'User Login',
      description: 'As a user, I want to login',
      priority: 'P1',
      storyPoints: 5,
    }) as { item: { id: string } };

    const bugFix = await executeTool('backlog_item_create', {
      title: 'Fix navigation bug',
      description: 'Navigation menu not closing on mobile',
      priority: 'P2',
      storyPoints: 2,
    }) as { item: { id: string } };

    // Step 3: Update sprint status to active
    await executeTool('sprint_update', {
      id: sprintId,
      status: 'active',
    });

    // Step 4: Update backlog items through workflow
    await executeTool('backlog_item_update', {
      id: userStory1.item.id,
      status: 'in-progress',
    });

    await executeTool('backlog_item_update', {
      id: userStory1.item.id,
      status: 'done',
    });

    await executeTool('backlog_item_update', {
      id: userStory2.item.id,
      status: 'done',
    });

    // Bug remains in progress
    await executeTool('backlog_item_update', {
      id: bugFix.item.id,
      status: 'in-progress',
    });

    // Step 5: Create daily standup
    await executeTool('standup_create', {
      sprintId,
      entries: [
        {
          memberId: 'member-1',
          yesterday: 'Completed user registration',
          today: 'Working on bug fix',
          blockers: [],
        },
      ],
    });

    // Step 6: Create blocker
    await executeTool('blocker_create', {
      description: 'Need design review for bug fix',
      impact: 'medium',
      blockedMembers: ['member-1'],
      affectedItems: [bugFix.item.id],
    });

    // Step 7: Create retrospective
    await executeTool('retro_create', {
      sprintId,
      format: 'start-stop-continue',
      feedback: [
        {
          category: 'start',
          content: 'Better standup format',
        },
        {
          category: 'stop',
          content: 'Late bug reports',
        },
        {
          category: 'continue',
          content: 'Pair programming',
        },
      ],
    });

    // Step 8: Complete sprint
    await executeTool('sprint_update', {
      id: sprintId,
      status: 'completed',
      goalAchieved: false,
      achievementNotes: 'User stories completed, bug carried over',
    });

    // Step 9: Create sprint review
    const reviewResult = await executeTool('review_create', {
      sprintId,
      completedItemIds: [userStory1.item.id, userStory2.item.id],
      incompleteItemIds: [bugFix.item.id],
      stakeholderFeedback: [
        'Happy with user stories',
        'Bug fix needs more work',
      ],
    });

    expect(reviewResult).toHaveProperty('success', true);
    expect((reviewResult as { review: { completedCount: number } }).review.completedCount).toBe(2);
    expect((reviewResult as { review: { incompleteCount: number } }).review.incompleteCount).toBe(1);

    // Verify final sprint state
    const sprintListResult = await executeTool('sprint_list', { status: 'completed' });
    const completedSprints = (sprintListResult as { sprints: { id: string }[] }).sprints;
    expect(completedSprints.some((s) => s.id === sprintId)).toBe(true);
  });
});
