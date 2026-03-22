import { tool } from "@opencode-ai/plugin";
import { 
  readData, 
  writeData, 
  generateId, 
  formatDate,
  type BacklogItem,
  type Sprint 
} from "./storage.js";

const BACKLOG_FILE = "backlog.json";
const SPRINTS_FILE = "sprints.json";

const StoryPointEstimates = [1, 2, 3, 5, 8, 13, 21];

interface BacklogItemInput {
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  priority?: number;
}

interface BacklogContext {
  directory?: string;
}

export const backlogTool = tool({
  name: "backlog",
  description: "Manage product backlog items",
  args: {
    action: tool.schema.enum(["add", "refine", "prioritize", "list", "estimate"]),
    item: tool.schema.object({
      title: tool.schema.string(),
      description: tool.schema.string().optional(),
      acceptanceCriteria: tool.schema.array(tool.schema.string()).optional(),
      storyPoints: tool.schema.number().optional(),
      priority: tool.schema.number().optional(),
    }).optional(),
    items: tool.schema.array(tool.schema.object({
      title: tool.schema.string(),
      description: tool.schema.string().optional(),
      acceptanceCriteria: tool.schema.array(tool.schema.string()).optional(),
      storyPoints: tool.schema.number().optional(),
      priority: tool.schema.number().optional(),
    })).optional(),
  },
  async execute(args, ctx: BacklogContext) {
    const basePath = ctx.directory || "";
    
    switch (args.action) {
      case "add":
        return addBacklogItems(args, basePath);
      case "refine":
        return refineBacklogItem(args, basePath);
      case "prioritize":
        return prioritizeBacklog(args, basePath);
      case "list":
        return listBacklog(args, basePath);
      case "estimate":
        return estimateStoryPoints(args, basePath);
      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  },
});

function addBacklogItems(args: { item?: BacklogItemInput; items?: BacklogItemInput[] }, basePath: string) {
  const backlog = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  
  const activeSprint = sprints.find(s => s.status === "active");
  const planningSprint = sprints.find(s => s.status === "planning");
  const targetSprint = activeSprint || planningSprint;
  
  const itemsToAdd: BacklogItemInput[] = [];
  
  if (args.item) {
    itemsToAdd.push(args.item);
  }
  
  if (args.items && args.items.length > 0) {
    itemsToAdd.push(...args.items);
  }
  
  if (itemsToAdd.length === 0) {
    return { 
      success: false, 
      error: "No items provided. Pass 'item' or 'items' parameter with backlog items to add." 
    };
  }
  
  const newItems: BacklogItem[] = itemsToAdd.map(item => {
    const maxPriority = backlog.length > 0 
      ? Math.max(...backlog.map(i => i.priority)) 
      : 0;
    
    return {
      id: generateId(),
      title: item.title,
      description: item.description || "",
      acceptanceCriteria: item.acceptanceCriteria || [],
      storyPoints: item.storyPoints || 0,
      priority: item.priority !== undefined ? item.priority : maxPriority + 1,
      status: "todo" as const,
      sprintId: targetSprint?.id,
      createdAt: formatDate(new Date()),
      updatedAt: formatDate(new Date()),
    };
  });
  
  backlog.push(...newItems);
  writeData(BACKLOG_FILE, backlog, basePath);
  
  return {
    success: true,
    added_count: newItems.length,
    items: newItems.map(item => ({
      id: item.id,
      title: item.title,
      storyPoints: item.storyPoints,
      priority: item.priority,
      status: item.status,
      sprintId: item.sprintId,
    })),
    message: `Added ${newItems.length} backlog item(s). ${targetSprint ? `Assigned to "${targetSprint.name}".` : "No active sprint, item is unassigned."}`,
  };
}

function refineBacklogItem(args: { item?: BacklogItemInput }, basePath: string) {
  if (!args.item || !args.item.title) {
    return { 
      success: false, 
      error: "Item with title is required to refine." 
    };
  }
  
  const backlog = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  
  const item = backlog.find(i => i.title.toLowerCase() === args.item!.title.toLowerCase());
  
  if (!item) {
    return { 
      success: false, 
      error: `Backlog item "${args.item.title}" not found.` 
    };
  }
  
  if (args.item.description) {
    item.description = args.item.description;
  }
  
  if (args.item.acceptanceCriteria) {
    item.acceptanceCriteria = args.item.acceptanceCriteria;
  }
  
  if (args.item.storyPoints !== undefined) {
    item.storyPoints = args.item.storyPoints;
  }
  
  item.updatedAt = formatDate(new Date());
  
  writeData(BACKLOG_FILE, backlog, basePath);
  
  return {
    success: true,
    item: {
      id: item.id,
      title: item.title,
      description: item.description,
      acceptanceCriteria: item.acceptanceCriteria,
      storyPoints: item.storyPoints,
      status: item.status,
    },
    message: `Backlog item "${item.title}" refined successfully.`,
  };
}

function prioritizeBacklog(args: { items?: BacklogItemInput[] }, basePath: string) {
  const backlog = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  
  if (backlog.length === 0) {
    return { 
      success: false, 
      error: "Backlog is empty. Add items first." 
    };
  }
  
  const sorted = [...backlog].sort((a, b) => a.priority - b.priority);
  
  return {
    success: true,
    prioritized_items: sorted.map((item, index) => ({
      rank: index + 1,
      id: item.id,
      title: item.title,
      priority: item.priority,
      storyPoints: item.storyPoints,
      status: item.status,
    })),
    message: `Backlog contains ${backlog.length} items sorted by priority.`,
  };
}

function listBacklog(args: { item?: BacklogItemInput }, basePath: string) {
  const backlog = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  
  if (backlog.length === 0) {
    return {
      success: true,
      items: [],
      total_count: 0,
      message: "Backlog is empty.",
    };
  }
  
  let filtered = backlog;
  
  if (args.item?.title) {
    const searchTerm = args.item.title.toLowerCase();
    filtered = backlog.filter(item => 
      item.title.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm)
    );
  }
  
  const sorted = filtered.sort((a, b) => a.priority - b.priority);
  
  const totalPoints = backlog.reduce((sum, item) => sum + item.storyPoints, 0);
  const todoPoints = backlog.filter(i => i.status === "todo").reduce((sum, i) => sum + i.storyPoints, 0);
  const inProgressPoints = backlog.filter(i => i.status === "in-progress").reduce((sum, i) => sum + i.storyPoints, 0);
  const donePoints = backlog.filter(i => i.status === "done").reduce((sum, i) => sum + i.storyPoints, 0);
  
  return {
    success: true,
    items: sorted.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      storyPoints: item.storyPoints,
      priority: item.priority,
      status: item.status,
      acceptanceCriteria: item.acceptanceCriteria,
      sprintId: item.sprintId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    summary: {
      total_count: backlog.length,
      total_points: totalPoints,
      by_status: {
        todo: { count: backlog.filter(i => i.status === "todo").length, points: todoPoints },
        in_progress: { count: backlog.filter(i => i.status === "in-progress").length, points: inProgressPoints },
        done: { count: backlog.filter(i => i.status === "done").length, points: donePoints },
      },
    },
    message: `Listed ${sorted.length} backlog item(s).`,
  };
}

function estimateStoryPoints(args: { item?: BacklogItemInput }, basePath: string) {
  if (!args.item?.title) {
    return {
      success: true,
      available_estimates: StoryPointEstimates,
      message: "Available Fibonacci story point estimates.",
    };
  }
  
  const backlog = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  const item = backlog.find(i => i.title.toLowerCase() === args.item!.title.toLowerCase());
  
  if (!item) {
    return {
      success: false,
      error: `Item "${args.item.title}" not found in backlog.`,
    };
  }
  
  if (item.storyPoints > 0) {
    return {
      success: true,
      item: {
        id: item.id,
        title: item.title,
        current_estimate: item.storyPoints,
      },
      message: `Item already has ${item.storyPoints} story points.`,
    };
  }
  
  const complexity = item.description?.length || 0;
  const hasAcceptanceCriteria = (item.acceptanceCriteria?.length || 0) > 0;
  
  let suggestedPoints: number;
  if (complexity < 100 && hasAcceptanceCriteria) {
    suggestedPoints = 2;
  } else if (complexity < 200 && hasAcceptanceCriteria) {
    suggestedPoints = 3;
  } else if (complexity < 300) {
    suggestedPoints = 5;
  } else if (complexity < 500) {
    suggestedPoints = 8;
  } else {
    suggestedPoints = 13;
  }
  
  return {
    success: true,
    item: {
      id: item.id,
      title: item.title,
      description_length: complexity,
      has_acceptance_criteria: hasAcceptanceCriteria,
    },
    suggested_points: suggestedPoints,
    available_estimates: StoryPointEstimates,
    message: `Based on complexity and clarity, suggest ${suggestedPoints} story points for this item.`,
  };
}
