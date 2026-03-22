import type { AgilePluginConfig, DefinitionOfDone, TeamMember } from '../types';
import { TeamRole } from '../types';

export const defaultSprintDurationWeeks = 2;

export const defaultTeamMembers: TeamMember[] = [
  {
    id: 'member-1',
    name: 'Product Owner',
    email: 'po@example.com',
    role: TeamRole.ProductOwner,
    availability: 100,
    skills: ['product-management', 'stakeholder-management', 'requirements'],
    daysOff: [],
  },
  {
    id: 'member-2',
    name: 'Scrum Master',
    email: 'sm@example.com',
    role: TeamRole.ScrumMaster,
    availability: 100,
    skills: ['facilitation', 'coaching', 'agile-practices'],
    daysOff: [],
  },
  {
    id: 'member-3',
    name: 'Lead Architect',
    email: 'architect@example.com',
    role: TeamRole.Architect,
    availability: 100,
    skills: ['system-design', 'code-review', 'technical-leadership'],
    daysOff: [],
  },
];

export const defaultDefinitionOfDone: DefinitionOfDone = {
  criteria: [
    'Code follows project style guidelines and passes linting',
    'All automated tests pass (unit, integration)',
    'Code has been reviewed and approved by at least one peer',
    'Documentation is updated (README, API docs, inline comments)',
    'No breaking changes to existing contracts/interfaces',
    'Performance impact considered and acceptable',
    'Security considerations addressed',
    'Product Owner has accepted the user story',
  ],
  scope: 'global',
  establishedAt: new Date(),
  approvedBy: ['member-1', 'member-2'],
};

export const defaultSprintGoalTemplate = `As a team, we will achieve {goal} by the end of this sprint while maintaining quality and following our Definition of Done.`;

export const defaultWorkingDaysPerWeek = 5;

export const defaultDailyStandupTime = '09:30';

export const defaultConfig: AgilePluginConfig = {
  defaultSprintDurationWeeks,
  teamMembers: defaultTeamMembers,
  definitionOfDone: defaultDefinitionOfDone,
  sprintGoalTemplate: defaultSprintGoalTemplate,
  workingDaysPerWeek: defaultWorkingDaysPerWeek,
  dailyStandupTime: defaultDailyStandupTime,
};

export function createSprintGoal(
  goal: string,
  goalTemplate: string = defaultSprintGoalTemplate
): string {
  return goalTemplate.replace('{goal}', goal);
}

export function calculateTeamCapacity(
  teamMembers: TeamMember[],
  sprintDurationWeeks: number = defaultSprintDurationWeeks
): number {
  const workingDays = sprintDurationWeeks * defaultWorkingDaysPerWeek;
  return teamMembers.reduce((total, member) => {
    const memberDays = workingDays * (member.availability / 100);
    const daysOff = member.daysOff.filter((d) => {
      const dayOfWeek = d.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    }).length;
    return total + (memberDays - daysOff) * 8;
  }, 0);
}

export function validateConfig(config: Partial<AgilePluginConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.defaultSprintDurationWeeks !== undefined) {
    if (config.defaultSprintDurationWeeks < 1 || config.defaultSprintDurationWeeks > 4) {
      errors.push('Sprint duration must be between 1 and 4 weeks');
    }
  }

  if (config.teamMembers !== undefined) {
    if (config.teamMembers.length === 0) {
      errors.push('Team must have at least one member');
    }
    const roles = config.teamMembers.map((m) => m.role);
    if (!roles.includes(TeamRole.ProductOwner)) {
      errors.push('Team must have a Product Owner');
    }
    if (!roles.includes(TeamRole.ScrumMaster)) {
      errors.push('Team must have a Scrum Master');
    }
  }

  if (config.definitionOfDone !== undefined) {
    if (config.definitionOfDone.criteria.length === 0) {
      errors.push('Definition of Done must have at least one criterion');
    }
  }

  if (config.workingDaysPerWeek !== undefined) {
    if (config.workingDaysPerWeek < 1 || config.workingDaysPerWeek > 7) {
      errors.push('Working days per week must be between 1 and 7');
    }
  }

  if (config.dailyStandupTime !== undefined) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(config.dailyStandupTime)) {
      errors.push('Daily standup time must be in HH:MM format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
