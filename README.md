# OpenCode Agile Team Plugin

A comprehensive agile team management plugin for OpenCode, providing Sprint, Backlog, Standup, Retro, Review, and Metrics tools.

## Installation

Add the plugin to your OpenCode configuration (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["opencode-agile-team"]
}
```

Or for local development, place the files in `.opencode/plugins/`.

## Available Tools

### Sprint Management (`sprint`)

Create and manage Scrum sprints.

```typescript
// Create a new sprint
sprint({ action: "create", duration_weeks: 2, goal: "Release v1.0" });

// Start a sprint
sprint({ action: "start", sprint_id: "..." });

// End a sprint
sprint({ action: "end", sprint_id: "..." });

// Generate sprint report
sprint({ action: "report", sprint_id: "..." });

// Set sprint goal
sprint({ action: "goal", sprint_id: "...", goal: "New goal" });
```

### Backlog Management (`backlog`)

Manage product backlog items.

```typescript
// Add items
backlog({ action: "add", items: [{ title: "User login", storyPoints: 3 }] });

// Refine an item
backlog({ action: "refine", item: { title: "User login", acceptanceCriteria: [...], storyPoints: 5 } });

// List backlog
backlog({ action: "list" });

// Prioritize
backlog({ action: "prioritize" });

// Estimate story points
backlog({ action: "estimate", item: { title: "User login" } });
```

### Daily Standup (`standup`)

Run daily standup meetings.

```typescript
// Start standup
standup({ action: "start", format: "three-questions" });

// Submit update
standup({ action: "report", entries: [{ member: "John", yesterday: "...", today: "...", blockers: [] }] });

// Generate summary
standup({ action: "summary" });

// List blockers
standup({ action: "blockers" });
```

### Sprint Retrospective (`retro`)

Conduct sprint retrospectives with multiple formats.

```typescript
// Start retro
retro({ action: "start", format: "start-stop-continue" });

// Collect feedback
retro({ action: "collect", entries: [{ type: "start", content: "Better code reviews", author: "John" }] });

// Vote on feedback
retro({ action: "vote" });

// Generate action items
retro({ action: "action-items" });

// Generate report
retro({ action: "report" });
```

### Sprint Review (`review`)

Conduct sprint review meetings.

```typescript
// Start review
review({ action: "start" });

// Record demos
review({ action: "demo", demos: [{ title: "New Dashboard", description: "...", url: "https://..." }] });

// Collect feedback
review({ action: "feedback", feedback: [{ type: "positive", content: "Great UI!", author: "Stakeholder" }] });

// Generate report
review({ action: "report" });
```

### Metrics (`metrics`)

Track and report team metrics.

```typescript
// Calculate velocity
metrics({ action: "velocity" });

// Sprint health
metrics({ action: "sprint-health" });

// Quality metrics
metrics({ action: "quality", data: { bugCount: 3, codeCoverage: 85 } });

// Blocker trends
metrics({ action: "blockers" });

// Full report
metrics({ action: "report" });
```

## Data Storage

All data is stored locally in the `.agile/` directory within your project:

- `sprints.json` - Sprint data
- `backlog.json` - Backlog items
- `standups.json` - Standup meeting records
- `retros.json` - Retrospective feedback
- `retro-actions.json` - Action items from retros
- `demos.json` - Sprint demo records
- `review-feedback.json` - Sprint review feedback

## Supported Retro Formats

- `start-stop-continue` (default)
- `4ls` (Loved, Learned, Lacked, Longed For)
- `sailboat` (Wind, Anchor, Rock, Island)
- `mad-sad-glad`

## License

MIT
