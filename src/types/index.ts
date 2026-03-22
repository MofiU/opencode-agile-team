/**
 * OpenCode Agile Team Plugin - Type Definitions
 *
 * Following 2025 Scrum Guide principles:
 * - Scrum is founded on empiricism and lean thinking
 * - Three pillars: Transparency, Inspection, Adaptation
 * - Five events: Sprint, Sprint Planning, Daily Scrum, Sprint Review, Sprint Retrospective
 * - Three accountabilities: Developers, Scrum Master, Product Owner
 */

/**
 * Team Roles with color theme assignments
 * Each role has a distinct color for visual identification in UI
 */
export enum TeamRole {
  ProductOwner = 'product-owner',
  ScrumMaster = 'scrum-master',
  Architect = 'architect',
  Frontend = 'frontend',
  Backend = 'backend',
  DevOps = 'devops',
  UIUX = 'ui-ux',
  QA = 'qa',
}

/**
 * Color theme mapping for team roles
 * Used for visual distinction in dashboards, reports, and UI elements
 */
export const TeamRoleColors: Record<TeamRole, string> = {
  [TeamRole.ProductOwner]: '#FF6B6B',   // Red - authority and leadership
  [TeamRole.ScrumMaster]: '#45B7D1',    // Cyan - facilitation and guidance
  [TeamRole.Architect]: '#9B59B6',      // Purple - technical vision
  [TeamRole.Frontend]: '#3498DB',       // Blue - client-side work
  [TeamRole.Backend]: '#27AE60',        // Green - server-side work
  [TeamRole.DevOps]: '#E67E22',         // Orange - operations and deployment
  [TeamRole.UIUX]: '#E91E63',           // Pink - design and UX
  [TeamRole.QA]: '#00BCD4',             // Teal - quality assurance
} as const;

/**
 * Priority levels for backlog items (P1-P4)
 * P1 = Highest priority, P4 = Lowest priority
 */
export enum Priority {
  P1 = 'P1',  // Critical - Must be done in current sprint
  P2 = 'P2',  // High - Should be done in current sprint
  P3 = 'P3',  // Medium - Planned for next sprint
  P4 = 'P4',  // Low - Backlog refinement candidate
}

/**
 * Story point scale based on Fibonacci sequence
 * Used for effort estimation in sprint planning
 */
export enum StoryPoint {
  SP0 = 0,   // No effort (padding/thumbnail)
  SP1 = 1,   // Very small task
  SP2 = 2,   // Small task
  SP3 = 3,   // Medium-small task
  SP5 = 5,   // Medium task
  SP8 = 8,   // Medium-large task
  SP13 = 13, // Large task
  SP21 = 21, // Very large task (consider splitting)
}

/**
 * Status values for backlog items
 * Following Scrum flow: Ready -> In Progress -> In Review -> Done
 */
export enum BacklogItemStatus {
  Backlog = 'backlog',           // In product backlog, not yet refined
  Ready = 'ready',               // Refined and ready for sprint
  InProgress = 'in-progress',   // Currently being worked on
  InReview = 'in-review',       // Pull request open, awaiting review
  Done = 'done',                 // Completed and acceptance criteria met
  Removed = 'removed',           // Removed from backlog (invalid/duplicate)
}

/**
 * A single item in the product backlog
 * Can be a user story, bug, task, or technical debt
 */
export interface BacklogItem {
  /** Unique identifier (e.g., 'US-001', 'BUG-042') */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description following user story format */
  description: string;
  /** Business value and priority */
  priority: Priority;
  /** Estimated effort in story points */
  storyPoints: StoryPoint | null;
  /** Current workflow status */
  status: BacklogItemStatus;
  /** Who requested or owns this item */
  requestedBy?: string;
  /** Who is assigned to implement this item */
  assignee?: TeamMember['id'];
  /** Acceptance criteria that must be met for completion */
  acceptanceCriteria: string[];
  /** Technical notes or implementation hints */
  technicalNotes?: string;
  /** Labels/tags for categorization */
  labels: string[];
  /** Parent item ID for sub-tasks */
  parentId?: string;
  /** Date when created */
  createdAt: Date;
  /** Date when last modified */
  updatedAt: Date;
  /** Date when completed */
  completedAt?: Date;
}

/**
 * Sprint goal that provides a shared objective for the sprint
 * Created during sprint planning and remains stable throughout the sprint
 */
export interface SprintGoal {
  /** Unique identifier */
  id: string;
  /** The sprint goal statement */
  goal: string;
  /** Whether this goal has been achieved */
  achieved: boolean;
  /** How the goal was achieved (if applicable) */
  achievementNotes?: string;
}

/**
 * A time-boxed iteration of work (typically 1-4 weeks)
 * Contains a set of backlog items to be completed
 */
export interface Sprint {
  /** Unique sprint number or name */
  id: string;
  /** Sprint name (e.g., 'Sprint 23', 'Sprint 2024-Q1-05') */
  name: string;
  /** Start date of the sprint */
  startDate: Date;
  /** End date of the sprint */
  endDate: Date;
  /** Sprint goal for this iteration */
  goal: SprintGoal;
  /** All items planned for this sprint */
  backlogItemIds: string[];
  /** Items that were not completed */
  carryOverItems: BacklogItem[];
  /** Team capacity in story points */
  capacity: number;
  /** Actual velocity in story points */
  velocity: number;
  /** Sprint status */
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  /** Date when created */
  createdAt: Date;
}

/**
 * A team member with their role and availability
 */
export interface TeamMember {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Primary role in the team */
  role: TeamRole;
  /** Availability percentage for the sprint (0-100) */
  availability: number;
  /** Skills and competencies */
  skills: string[];
  /** Days off during the sprint */
  daysOff: Date[];
}

/**
 * Daily standup entry for a single team member
 */
export interface StandupEntry {
  /** Team member who provided the update */
  memberId: TeamMember['id'];
  /** What was accomplished since last standup */
  yesterday: string;
  /** What will be worked on today */
  today: string;
  /** Any blockers or impediments */
  blockers: string[];
  /** Any additional notes */
  notes?: string;
}

/**
 * Daily Scrum / Standup meeting data
 * Time-boxed to 15 minutes, held at the same time and place daily
 */
export interface DailyStandup {
  /** Unique identifier */
  id: string;
  /** Date of the standup */
  date: Date;
  /** Sprint this standup belongs to */
  sprintId: Sprint['id'];
  /** All team members' updates */
  entries: StandupEntry[];
  /** Any impediments raised that need SM attention */
  impediments: string[];
  /** Location/URL for the standup */
  location?: string;
  /** Duration in minutes */
  duration: number;
}

/**
 * Retrospective meeting format options
 * Different formats for variety and engagement
 */
export enum RetroFormat {
  StartStopContinue = 'start-stop-continue',  // What to start, stop, continue
  MadSadGlad = 'mad-sad-glad',               // Emotional check-in format
  FourLs = 'four-ls',                        // Liked, Learned, Lacked, Longed For
  Sailboat = 'sailboat',                     // Wind, anchors, rocks, island
  Starfish = 'starfish',                     // Keep, More, Less, Stop, Start
  Flower = 'flower',                         // Petals: Planning, Communication, etc.
}

/**
 * A single feedback item in a retrospective
 */
export interface RetroFeedback {
  /** Unique identifier */
  id: string;
  /** Category or theme of the feedback */
  category: string;
  /** The feedback content */
  content: string;
  /** Who provided this feedback (optional for anonymity) */
  author?: TeamMember['id'];
  /** Whether this has been actioned */
  actioned: boolean;
  /** Action taken in response */
  actionNotes?: string;
}

/**
 * Sprint Retrospective meeting data
 * Held at the end of each sprint to inspect and adapt
 */
export interface Retrospective {
  /** Unique identifier */
  id: string;
  /** Sprint this retro belongs to */
  sprintId: Sprint['id'];
  /** Format used for this retrospective */
  format: RetroFormat;
  /** Feedback collected from team members */
  feedback: RetroFeedback[];
  /** Action items created from the retro */
  actionItems: string[];
  /** Overall sentiment/mood score (1-5) */
  moodScore?: number;
  /** Date when held */
  heldAt: Date;
  /** Participants */
  participants: TeamMember['id'][];
}

/**
 * Sprint Review meeting data
 * Held at the end of each sprint to inspect the increment
 */
export interface SprintReview {
  /** Unique identifier */
  id: string;
  /** Sprint being reviewed */
  sprintId: Sprint['id'];
  /** Increment being demonstrated */
  incrementDescription: string;
  /** Product Backlog items completed */
  completedItems: BacklogItem[];
  /** Product Backlog items not completed */
  incompleteItems: BacklogItem[];
  /** Feedback from stakeholders */
  stakeholderFeedback: string[];
  /** Date when held */
  heldAt: Date;
  /** Participants */
  participants: (TeamMember['id'] | string)[];
  /** Next sprint planning date */
  nextSprintPlanningDate?: Date;
}

/**
 * Definition of Done checklist
 * Shared understanding of what it means for work to be complete
 */
export interface DefinitionOfDone {
  /** List of criteria that must be met */
  criteria: string[];
  /** Is this specific to a component/type */
  scope?: 'global' | 'user-story' | 'bug' | 'tech-task';
  /** When this was established */
  establishedAt: Date;
  /** Who approved this definition */
  approvedBy: TeamMember['id'][];
}

/**
 * Blockers and impediments that affect delivery
 */
export interface Blockers {
  /** Unique identifier */
  id: string;
  /** Description of the blocker */
  description: string;
  /** Impact on the sprint/team */
  impact: 'critical' | 'high' | 'medium' | 'low';
  /** Who is blocked */
  blockedMembers: TeamMember['id'][];
  /** Who can resolve this */
  owner?: TeamMember['id'];
  /** When identified */
  identifiedAt: Date;
  /** When resolved (if applicable) */
  resolvedAt?: Date;
  /** Resolution notes */
  resolution?: string;
  /** Backlog items affected */
  affectedItems: string[];
}

/**
 * Sprint Report / Burndown data
 * Used for tracking sprint progress
 */
export interface SprintReport {
  /** Sprint this report is for */
  sprintId: Sprint['id'];
  /** Total committed story points */
  committedPoints: number;
  /** Completed story points */
  completedPoints: number;
  /** Remaining story points at report time */
  remainingPoints: number;
  /** Daily burndown data points */
  burndownData: { date: Date; remaining: number }[];
  /** Ideal burndown trend */
  idealBurndown: { date: Date; remaining: number }[];
  /** Calculated velocity */
  velocity: number;
  /** Whether sprint target was met */
  targetMet: boolean;
  /** Summary of the sprint */
  summary: string;
  /** Generated at */
  generatedAt: Date;
}

/**
 * Product Backlog
 * An ordered list of everything that is known to be needed in the product
 */
export interface ProductBacklog {
  /** Unique identifier */
  id: string;
  /** Product name */
  productName: string;
  /** Product vision and purpose */
  vision: string;
  /** All backlog items ordered by priority */
  items: BacklogItem[];
  /** Last updated */
  updatedAt: Date;
}

/**
 * Configuration for the Agile Team Plugin
 */
export interface AgilePluginConfig {
  /** Default sprint duration in weeks */
  defaultSprintDurationWeeks: number;
  /** Team members */
  teamMembers: TeamMember[];
  /** Definition of Done */
  definitionOfDone: DefinitionOfDone;
  /** Sprint Goal template */
  sprintGoalTemplate: string;
  /** Working days per week */
  workingDaysPerWeek: number;
  /** Daily standup time */
  dailyStandupTime: string;
}

/**
 * Plugin prefix for agent and command names
 */
export const PLUGIN_PREFIX = 'agile:';

/**
 * Agent names following the pattern agile:<role>
 */
export enum AgileAgent {
  ScrumMaster = `${PLUGIN_PREFIX}scrum-master`,
  ProductOwner = `${PLUGIN_PREFIX}product-owner`,
  Architect = `${PLUGIN_PREFIX}architect`,
  FrontendDev = `${PLUGIN_PREFIX}frontend`,
  BackendDev = `${PLUGIN_PREFIX}backend`,
  DevOps = `${PLUGIN_PREFIX}devops`,
  UIUX = `${PLUGIN_PREFIX}ui-ux`,
  QA = `${PLUGIN_PREFIX}qa`,
}
