# OpenCode Agile Team Plugin

An OpenCode plugin that brings an entire Agile team into your development workflow. Manages sprints, backlogs, standups, retrospectives, and more using the Scrum framework (2025 Guide).

## Features

### 🤖 AI Agent Team

| Agent | Role | Color |
|-------|------|-------|
| `agile:product-owner` | Product Owner - maximizes value, owns backlog | #FF6B6B |
| `agile:scrum-master` | Scrum Master - facilitates ceremonies, removes blockers | #45B7D1 |
| `agile:architect` | Architect - technical decisions, system design | #9B59B6 |
| `agile:frontend` | Frontend Engineer - UI development | #3498DB |
| `agile:backend` | Backend Engineer - API and services | #27AE60 |
| `agile:devops` | DevOps Engineer - CI/CD, infrastructure | #E67E22 |
| `agile:ui-ux` | UI/UX Designer - user experience | #E91E63 |
| `agile:qa` | QA Engineer - testing and quality | #00BCD4 |

### 🛠️ Tools

#### Sprint Management
- `sprint_create` - Create a new sprint with goal
- `sprint_list` - List all sprints
- `sprint_update` - Update sprint status/goal

#### Backlog Management
- `backlog_item_create` - Create user story, bug, or task
- `backlog_item_update` - Update status, priority, assignee
- `backlog_item_list` - List items with filters

#### Ceremonies
- `standup_create` - Record daily standup
- `standup_list` - View standup history
- `retro_create` - Create sprint retrospective
- `retro_add_feedback` - Add retrospective feedback
- `review_create` - Create sprint review

#### Blockers
- `blocker_create` - Log an impediment
- `blocker_resolve` - Mark blocker as resolved
- `blocker_list` - List blockers with filters

#### Team
- `team_capacity` - Calculate sprint capacity
- `config_validate` - Validate plugin configuration

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-agile-team"
  ]
}
```

## Usage

### Commands

```bash
/sprint create --name "Sprint 1" --goal "Complete user auth"
/backlog add --title "User Login" --priority P1 --points 5
/standup --sprintId sprint-xxx
/retro start --format start-stop-continue
/blocker create --description "Need API access" --impact high
```

### Slack Commands

```bash
/sprint    - Sprint management
/backlog   - Backlog management  
/standup   - Daily standup
/retro     - Sprint retrospective
/review    - Sprint review
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Test
npm test

# Test with watch
npm run test:watch

# Coverage
npm run test:coverage
```

## Testing

The plugin includes comprehensive integration tests covering:

- Sprint lifecycle (create → active → complete)
- Backlog item workflow (backlog → ready → in-progress → done)
- Daily standup operations
- Sprint retrospective with multiple formats
- Sprint review and stakeholder feedback
- Blocker management and resolution
- Team capacity calculations
- Complete end-to-end sprint workflow

## Architecture

```
src/
├── index.ts          # Plugin entry point
├── types/            # TypeScript type definitions
├── agents/          # AI agent definitions
│   ├── product-owner.ts
│   ├── scrum-master.ts
│   ├── architect.ts
│   ├── frontend-engineer.ts
│   ├── backend-engineer.ts
│   ├── devops-engineer.ts
│   ├── uiux-designer.ts
│   └── qa-engineer.ts
├── tools/           # Tool definitions
│   ├── sprint.ts
│   ├── backlog.ts
│   ├── standup.ts
│   ├── retro.ts
│   ├── review.ts
│   └── blocker.ts
└── config/         # Default configurations
    └── defaults.ts
```

## License

MIT
