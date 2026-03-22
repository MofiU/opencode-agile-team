import { tool } from "@opencode-ai/plugin";
import { 
  readData, 
  writeData, 
  generateId, 
  formatDate,
  type RetroEntry,
  type RetroAction,
  type Sprint 
} from "./storage.js";

const RETROS_FILE = "retros.json";
const RETRO_ACTIONS_FILE = "retro-actions.json";
const SPRINTS_FILE = "sprints.json";

type RetroFormat = "start-stop-continue" | "4ls" | "sailboat" | "mad-sad-glad";

interface RetroEntryInput {
  type: string;
  content: string;
  author?: string;
}

interface RetroContext {
  directory?: string;
}

function getRetroCategories(format: RetroFormat): { type: string; label: string }[] {
  switch (format) {
    case "4ls":
      return [
        { type: "loved", label: "Loved" },
        { type: "learned", label: "Learned" },
        { type: "lacked", label: "Lacked" },
        { type: "longed-for", label: "Longed For" },
      ];
    case "sailboat":
      return [
        { type: "wind", label: "Wind (positives)" },
        { type: "anchor", label: "Anchor (negatives)" },
        { type: "rock", label: "Rock (risks)" },
        { type: "island", label: "Island (goals)" },
      ];
    case "mad-sad-glad":
      return [
        { type: "mad", label: "Mad" },
        { type: "sad", label: "Sad" },
        { type: "glad", label: "Glad" },
      ];
    case "start-stop-continue":
    default:
      return [
        { type: "start", label: "Start" },
        { type: "stop", label: "Stop" },
        { type: "continue", label: "Continue" },
      ];
  }
}

export const retroTool = tool({
  name: "retro",
  description: "Conduct sprint retrospective",
  args: {
    action: tool.schema.enum(["start", "collect", "vote", "action-items", "report"]),
    format: tool.schema.enum(["start-stop-continue", "4ls", "sailboat", "mad-sad-glad"]).default("start-stop-continue"),
    entries: tool.schema.array(tool.schema.object({
      type: tool.schema.string(),
      content: tool.schema.string(),
      author: tool.schema.string().optional(),
    })).optional(),
  },
  async execute(args, ctx: RetroContext) {
    const basePath = ctx.directory || "";
    
    switch (args.action) {
      case "start":
        return startRetro(args, basePath);
      case "collect":
        return collectFeedback(args, basePath);
      case "vote":
        return voteOnFeedback(args, basePath);
      case "action-items":
        return generateActionItems(args, basePath);
      case "report":
        return generateRetroReport(args, basePath);
      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  },
});

function startRetro(args: { format?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const activeSprint = sprints.find(s => s.status === "active") || sprints.find(s => s.status === "completed");
  
  if (!activeSprint) {
    return { 
      success: false, 
      error: "No sprint found. Create and complete a sprint first to run a retrospective." 
    };
  }
  
  const retros = readData<RetroEntry[]>(RETROS_FILE, basePath) || [];
  const existingRetro = retros.find(r => r.sprintId === activeSprint.id);
  
  if (existingRetro) {
    return {
      success: true,
      retro: {
        sprint_id: activeSprint.id,
        sprint_name: activeSprint.name,
        format: args.format || "start-stop-continue",
        status: "in-progress",
        existing: true,
      },
      message: `Retro for "${activeSprint.name}" already exists. Use 'collect' to add feedback.`,
    };
  }
  
  const format = (args.format || "start-stop-continue") as RetroFormat;
  const categories = getRetroCategories(format);
  
  return {
    success: true,
    retro: {
      sprint_id: activeSprint.id,
      sprint_name: activeSprint.name,
      format,
      status: "started",
      categories: categories.map(c => ({ type: c.type, label: c.label })),
      prompt: `Share your feedback for the "${activeSprint.name}" retrospective.\nGroup your input by category: ${categories.map(c => c.label).join(", ")}.`,
    },
    message: `Retrospective started for "${activeSprint.name}" using ${format} format.`,
  };
}

function collectFeedback(args: { entries?: RetroEntryInput[]; format?: string }, basePath: string) {
  const entries = args.entries;
  
  if (!entries || entries.length === 0) {
    return { 
      success: false, 
      error: "No entries provided. Pass 'entries' parameter with retro feedback." 
    };
  }
  
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const activeSprint = sprints.find(s => s.status === "active") || sprints.find(s => s.status === "completed");
  
  if (!activeSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const retros = readData<RetroEntry[]>(RETROS_FILE, basePath) || [];
  
  const newEntries: RetroEntry[] = entries.map(entry => ({
    id: generateId(),
    sprintId: activeSprint.id,
    type: entry.type,
    content: entry.content,
    author: entry.author || "anonymous",
    votes: 0,
  }));
  
  retros.push(...newEntries);
  writeData(RETROS_FILE, retros, basePath);
  
  const groupedEntries = newEntries.reduce((acc, entry) => {
    if (!acc[entry.type]) {
      acc[entry.type] = [];
    }
    acc[entry.type].push({ id: entry.id, content: entry.content, author: entry.author });
    return acc;
  }, {} as Record<string, { id: string; content: string; author: string }[]>);
  
  return {
    success: true,
    collected_count: newEntries.length,
    grouped_by_type: groupedEntries,
    message: `Collected ${newEntries.length} feedback item(s). Use 'vote' to prioritize.`,
  };
}

function voteOnFeedback(args: Record<string, never>, basePath: string) {
  const retros = readData<RetroEntry[]>(RETROS_FILE, basePath) || [];
  
  if (retros.length === 0) {
    return { success: false, error: "No retro entries found. Run 'start' and 'collect' first." };
  }
  
  const latestRetroSprintId = retros[retros.length - 1].sprintId;
  const retroEntries = retros.filter(r => r.sprintId === latestRetroSprintId);
  
  const sortedByVotes = [...retroEntries].sort((a, b) => b.votes - a.votes);
  
  const groupedByType: Record<string, { content: string; votes: number; author: string }[]> = {};
  
  for (const entry of sortedByVotes) {
    if (!groupedByType[entry.type]) {
      groupedByType[entry.type] = [];
    }
    groupedByType[entry.type].push({
      content: entry.content,
      votes: entry.votes,
      author: entry.author,
    });
  }
  
  const topItems = sortedByVotes.slice(0, 5);
  
  return {
    success: true,
    total_entries: retroEntries.length,
    top_voted: topItems.map(e => ({ id: e.id, type: e.type, content: e.content, votes: e.votes })),
    grouped_by_type: groupedByType,
    message: `${retroEntries.length} items collected. Top voted items highlighted for action planning.`,
  };
}

function generateActionItems(args: { entries?: RetroEntryInput[] }, basePath: string) {
  const retros = readData<RetroEntry[]>(RETROS_FILE, basePath) || [];
  
  if (retros.length === 0) {
    return { success: false, error: "No retro entries found. Run 'start' and 'collect' first." };
  }
  
  const latestRetroSprintId = retros[retros.length - 1].sprintId;
  const retroEntries = retros.filter(r => r.sprintId === latestRetroSprintId);
  
  const topEntries = [...retroEntries]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);
  
  const actions = readData<RetroAction[]>(RETRO_ACTIONS_FILE, basePath) || [];
  
  const newActions: RetroAction[] = (args.entries || topEntries.map(e => ({
    description: `Address: ${e.content}`,
    owner: e.author,
  }))).map(item => ({
    id: generateId(),
    retroId: latestRetroSprintId,
    description: item.content || item.description || "",
    owner: item.author || item.owner || "unassigned",
    status: "open" as const,
    createdAt: formatDate(new Date()),
  }));
  
  actions.push(...newActions);
  writeData(RETRO_ACTIONS_FILE, actions, basePath);
  
  return {
    success: true,
    action_items_count: newActions.length,
    action_items: newActions.map(a => ({
      id: a.id,
      description: a.description,
      owner: a.owner,
      status: a.status,
    })),
    message: `Generated ${newActions.length} action item(s) from retro feedback.`,
  };
}

function generateRetroReport(args: Record<string, never>, basePath: string) {
  const retros = readData<RetroEntry[]>(RETROS_FILE, basePath) || [];
  const actions = readData<RetroAction[]>(RETRO_ACTIONS_FILE, basePath) || [];
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  
  if (retros.length === 0) {
    return { success: false, error: "No retro data found. Run 'start' and 'collect' first." };
  }
  
  const latestRetroSprintId = retros[retros.length - 1].sprintId;
  const retroEntries = retros.filter(r => r.sprintId === latestRetroSprintId);
  const retroActions = actions.filter(a => a.retroId === latestRetroSprintId);
  const sprint = sprints.find(s => s.id === latestRetroSprintId);
  
  const groupedByType: Record<string, { items: { content: string; votes: number; author: string }[]; total_votes: number }> = {};
  
  for (const entry of retroEntries) {
    if (!groupedByType[entry.type]) {
      groupedByType[entry.type] = { items: [], total_votes: 0 };
    }
    groupedByType[entry.type].items.push({
      content: entry.content,
      votes: entry.votes,
      author: entry.author,
    });
    groupedByType[entry.type].total_votes += entry.votes;
  }
  
  const sortedTypes = Object.entries(groupedByType)
    .sort((a, b) => b[1].total_votes - a[1].total_votes)
    .map(([type, data]) => ({
      type,
      item_count: data.items.length,
      total_votes: data.total_votes,
      items: data.items.sort((a, b) => b.votes - a.votes),
    }));
  
  return {
    success: true,
    report: {
      sprint: sprint ? { id: sprint.id, name: sprint.name } : null,
      total_feedback_items: retroEntries.length,
      by_category: sortedTypes,
      action_items: {
        total: retroActions.length,
        open: retroActions.filter(a => a.status === "open").length,
        completed: retroActions.filter(a => a.status === "done").length,
        items: retroActions.map(a => ({
          id: a.id,
          description: a.description,
          owner: a.owner,
          status: a.status,
        })),
      },
    },
    message: `Retro report generated for "${sprint?.name || "Unknown Sprint"}".`,
  };
}
