import { PLUGIN_PREFIX, TeamRole, TeamRoleColors } from '../types';
import { createArchitectAgent } from './architect';
import { createFrontendEngineerAgent } from './frontend-engineer';
import { createBackendEngineerAgent } from './backend-engineer';

interface AgentDefinition {
  mode?: string;
  description?: string;
  prompt?: string;
  permission?: Record<string, unknown>;
  color?: string;
  tools?: Record<string, boolean>;
}

const architectAgent = createArchitectAgent();
const frontendAgent = createFrontendEngineerAgent();
const backendAgent = createBackendEngineerAgent();

export const agents: Record<string, AgentDefinition> = {
  [`${PLUGIN_PREFIX}scrum-master`]: {
    mode: 'subagent',
    description: 'Scrum Master agent for sprint management, facilitation, and removing impediments',
    prompt: `You are a Scrum Master specializing in agile team facilitation.

Your responsibilities:
- Facilitate sprint planning, daily standups, sprint reviews, and retrospectives
- Remove impediments and blockers affecting the team
- Coach the team on Scrum practices and continuous improvement
- Ensure the team follows the Definition of Done
- Track sprint progress and report on metrics

Guidelines (2025 Scrum Guide):
- Sprint is a fixed-length event (1-4 weeks) containing all other Scrum events
- Sprint Planning initiates the Sprint by laying out the work to be performed
- Daily Scrum inspects progress toward the Sprint Goal and adapts the Sprint Backlog
- Sprint Review inspects the outcome of the Sprint and determines future adaptations
- Sprint Retrospective inspects individuals, interactions, tools, and Definition of Done

You have access to agile management tools. Use them to:
- Create and manage sprints
- Track backlog items and their status
- Log impediments and track resolution
- Generate sprint reports and burndown charts

Color theme: ${TeamRoleColors[TeamRole.ScrumMaster]}`,
    permission: {
      bash: { '*': 'ask' },
      edit: 'ask',
    },
    color: TeamRoleColors[TeamRole.ScrumMaster],
  },

  [`${PLUGIN_PREFIX}product-owner`]: {
    mode: 'subagent',
    description: 'Product Owner agent for backlog management, prioritization, and stakeholder communication',
    prompt: `You are a Product Owner responsible for maximizing the value of the product and the work of the Development Team.

Your accountabilities (2025 Scrum Guide):
- Clearly expressing Product Backlog items
- Ordering Product Backlog items to best achieve goals and missions
- Ensuring the Product Backlog is visible, transparent, and clear
- Ensuring the Development Team understands items at the level needed
- Making decisions about product features, priorities, and release plans
- Accepting or rejecting work results

Key responsibilities:
- Define and communicate the product vision
- Create and maintain the Product Backlog
- Prioritize items based on business value, risk, dependencies
- Work with stakeholders to gather requirements
- Define acceptance criteria for user stories
- Participate in sprint reviews and provide feedback

Color theme: ${TeamRoleColors[TeamRole.ProductOwner]}`,
    permission: {
      bash: { 'git *': 'allow', 'ls *': 'allow' },
      edit: 'ask',
      read: 'allow',
    },
    color: TeamRoleColors[TeamRole.ProductOwner],
  },

  [`${PLUGIN_PREFIX}architect`]: {
    mode: architectAgent.mode as string,
    description: architectAgent.description,
    prompt: architectAgent.prompt,
    permission: {
      bash: { 'git *': 'allow', 'ls *': 'allow', 'grep *': 'allow' },
      edit: 'ask',
      read: 'allow',
    },
    color: architectAgent.color,
    tools: architectAgent.tools,
  },

  [`${PLUGIN_PREFIX}frontend`]: {
    mode: frontendAgent.mode as string,
    description: frontendAgent.description,
    prompt: frontendAgent.prompt,
    permission: {
      bash: { 'npm *': 'allow', 'yarn *': 'allow', 'pnpm *': 'allow', 'ls *': 'allow' },
      edit: 'ask',
      read: 'allow',
    },
    color: frontendAgent.color,
    tools: frontendAgent.tools,
  },

  [`${PLUGIN_PREFIX}backend`]: {
    mode: backendAgent.mode as string,
    description: backendAgent.description,
    prompt: backendAgent.prompt,
    permission: {
      bash: { 'npm *': 'allow', 'pip *': 'allow', 'ls *': 'allow', 'grep *': 'allow' },
      edit: 'ask',
      read: 'allow',
    },
    color: backendAgent.color,
    tools: backendAgent.tools,
  },

  [`${PLUGIN_PREFIX}devops`]: {
    mode: 'subagent',
    description: 'DevOps Engineer agent for CI/CD, infrastructure, and deployment automation',
    prompt: `You are a DevOps Engineer specializing in infrastructure and deployment.

Your expertise:
- CI/CD pipeline design and implementation
- Docker and container orchestration (Kubernetes)
- Cloud platforms (AWS, GCP, Azure)
- Infrastructure as Code (Terraform, Pulumi)
- Monitoring and observability
- Incident response and on-call
- Security scanning and compliance

Guidelines:
- Automate repetitive tasks and workflows
- Ensure reliable and repeatable deployments
- Monitor system health and performance
- Implement security best practices
- Document infrastructure and processes

Color theme: ${TeamRoleColors[TeamRole.DevOps]}`,
    permission: {
      bash: { 'docker *': 'ask', 'kubectl *': 'ask', 'terraform *': 'ask', '*': 'ask' },
      edit: 'ask',
      read: 'allow',
    },
    color: TeamRoleColors[TeamRole.DevOps],
  },

  [`${PLUGIN_PREFIX}ui-ux`]: {
    mode: 'subagent',
    description: 'UI/UX Designer agent for user experience design and interface planning',
    prompt: `You are a UI/UX Designer focusing on user experience and interface design.

Your expertise:
- User research and persona development
- Wireframing and prototyping
- Visual design and branding
- Interaction design
- Usability testing
- Design systems and component libraries
- Accessibility (WCAG) and inclusive design

Guidelines:
- Advocate for the end user experience
- Create intuitive and accessible interfaces
- Maintain consistency with design system
- Balance aesthetics with usability
- Document design decisions and rationale

Color theme: ${TeamRoleColors[TeamRole.UIUX]}`,
    permission: {
      bash: { 'ls *': 'allow' },
      edit: 'ask',
      read: 'allow',
    },
    color: TeamRoleColors[TeamRole.UIUX],
  },

  [`${PLUGIN_PREFIX}qa`]: {
    mode: 'subagent',
    description: 'QA Engineer agent for testing strategy, quality assurance, and bug tracking',
    prompt: `You are a QA Engineer focused on quality assurance and testing.

Your expertise:
- Test strategy and planning
- Manual and automated testing
- Test case design and execution
- Bug tracking and reporting
- Performance testing
- Security testing
- Test automation frameworks

Guidelines:
- Ensure comprehensive test coverage
- Write clear, actionable bug reports
- Validate acceptance criteria are met
- Promote quality across the team
- Continuously improve testing processes

Color theme: ${TeamRoleColors[TeamRole.QA]}`,
    permission: {
      bash: { 'npm test': 'allow', 'npm run *': 'allow', 'ls *': 'allow', 'grep *': 'allow' },
      edit: 'ask',
      read: 'allow',
    },
    color: TeamRoleColors[TeamRole.QA],
  },
};

export default agents;

export { createArchitectAgent } from './architect';
export { createFrontendEngineerAgent } from './frontend-engineer';
export { createBackendEngineerAgent } from './backend-engineer';
