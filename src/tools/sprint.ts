import { tool } from "@opencode-ai/plugin";
import { 
  readData, 
  writeData, 
  generateId, 
  formatDate, 
  addWeeks,
  type Sprint,
  type BacklogItem 
} from "./storage.js";

const SPRINTS_FILE = "sprints.json";

interface SprintContext {
  directory?: string;
}

export const sprintTool = tool({
  name: "sprint",
  description: "Create and manage sprint artifacts",
  args: {
    action: tool.schema.enum(["create", "start", "end", "report", "goal"]),
    sprint_id: tool.schema.string().optional(),
    duration_weeks: tool.schema.number().default(2),
    goal: tool.schema.string().optional(),
  },
  async execute(args, ctx: SprintContext) {
    const basePath = ctx.directory || "";
    
    switch (args.action) {
      case "create":
        return createSprint(args, basePath);
      case "start":
        return startSprint(args, basePath);
      case "end":
        return endSprint(args, basePath);
      case "report":
        return generateSprintReport(args, basePath);
      case "goal":
        return setSprintGoal(args, basePath);
      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  },
});

function createSprint(args: { duration_weeks?: number; goal?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  
  const startDate = new Date();
  const endDate = addWeeks(startDate, args.duration_weeks || 2);
  
  const sprintNumber = sprints.filter(s => s.status !== "completed").length + 1;
  
  const newSprint: Sprint = {
    id: generateId(),
    name: `Sprint ${sprintNumber}`,
    goal: args.goal || "",
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    status: "planning",
    burndown: [],
  };
  
  sprints.push(newSprint);
  writeData(SPRINTS_FILE, sprints, basePath);
  
  return {
    success: true,
    sprint: {
      id: newSprint.id,
      name: newSprint.name,
      goal: newSprint.goal,
      startDate: newSprint.startDate,
      endDate: newSprint.endDate,
      status: newSprint.status,
      duration_weeks: args.duration_weeks || 2,
    },
    message: `Sprint "${newSprint.name}" created successfully. Ready for planning.`,
  };
}

function startSprint(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  
  let targetSprint: Sprint | undefined;
  
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "planning");
  }
  
  if (!targetSprint) {
    return { 
      success: false, 
      error: "No sprint found to start. Create a sprint first or provide a valid sprint_id." 
    };
  }
  
  if (targetSprint.status === "active") {
    return { 
      success: false, 
      error: `Sprint "${targetSprint.name}" is already active.` 
    };
  }
  
  if (targetSprint.status === "completed") {
    return { 
      success: false, 
      error: `Sprint "${targetSprint.name}" is already completed.` 
    };
  }
  
  targetSprint.status = "active";
  
  const backlogItems = readData<BacklogItem[]>("backlog.json", basePath) || [];
  const sprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
  const totalPoints = sprintItems.reduce((sum, item) => sum + item.storyPoints, 0);
  
  const today = new Date();
  const startDate = new Date(targetSprint.startDate);
  const endDate = new Date(targetSprint.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const idealBurndown = totalPoints - (totalPoints * (daysElapsed / totalDays));
  
  targetSprint.burndown = [{
    date: formatDate(today),
    remaining: totalPoints,
    ideal: Math.max(0, idealBurndown),
  }];
  
  targetSprint.velocity = totalPoints;
  
  writeData(SPRINTS_FILE, sprints, basePath);
  
  return {
    success: true,
    sprint: {
      id: targetSprint.id,
      name: targetSprint.name,
      goal: targetSprint.goal,
      startDate: targetSprint.startDate,
      endDate: targetSprint.endDate,
      status: targetSprint.status,
      planned_velocity: totalPoints,
    },
    message: `Sprint "${targetSprint.name}" started successfully. ${sprintItems.length} items with ${totalPoints} story points.`,
  };
}

function endSprint(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const backlogItems = readData<BacklogItem[]>("backlog.json", basePath) || [];
  
  let targetSprint: Sprint | undefined;
  
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active");
  }
  
  if (!targetSprint) {
    return { 
      success: false, 
      error: "No active sprint found to end." 
    };
  }
  
  if (targetSprint.status === "completed") {
    return { 
      success: false, 
      error: `Sprint "${targetSprint.name}" is already completed.` 
    };
  }
  
  targetSprint.status = "completed";
  
  const sprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
  const completedItems = sprintItems.filter(item => item.status === "done");
  const completedPoints = completedItems.reduce((sum, item) => sum + item.storyPoints, 0);
  const plannedPoints = sprintItems.reduce((sum, item) => sum + item.storyPoints, 0);
  
  targetSprint.velocity = completedPoints;
  
  const today = new Date();
  const startDate = new Date(targetSprint.startDate);
  const endDate = new Date(targetSprint.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (targetSprint.burndown && targetSprint.burndown.length > 0) {
    const lastEntry = targetSprint.burndown[targetSprint.burndown.length - 1];
    targetSprint.burndown.push({
      date: formatDate(today),
      remaining: 0,
      ideal: 0,
    });
  }
  
  writeData(SPRINTS_FILE, sprints, basePath);
  
  const velocity = sprints
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + (s.velocity || 0), 0) / sprints.filter(s => s.status === "completed").length;
  
  return {
    success: true,
    sprint: {
      id: targetSprint.id,
      name: targetSprint.name,
      status: "completed",
      completed_points: completedPoints,
      planned_points: plannedPoints,
      completion_rate: plannedPoints > 0 ? Math.round((completedPoints / plannedPoints) * 100) : 0,
      average_velocity: Math.round(velocity) || 0,
    },
    message: `Sprint "${targetSprint.name}" completed. Completed ${completedPoints}/${plannedPoints} story points.`,
  };
}

function generateSprintReport(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const backlogItems = readData<BacklogItem[]>("backlog.json", basePath) || [];
  
  let targetSprint: Sprint | undefined;
  
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active") || sprints.find(s => s.status === "completed");
  }
  
  if (!targetSprint) {
    return { 
      success: false, 
      error: "No sprint found. Create a sprint first." 
    };
  }
  
  const sprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
  const todoItems = sprintItems.filter(item => item.status === "todo");
  const inProgressItems = sprintItems.filter(item => item.status === "in-progress");
  const doneItems = sprintItems.filter(item => item.status === "done");
  
  const plannedPoints = sprintItems.reduce((sum, item) => sum + item.storyPoints, 0);
  const completedPoints = doneItems.reduce((sum, item) => sum + item.storyPoints, 0);
  const inProgressPoints = inProgressItems.reduce((sum, item) => sum + item.storyPoints, 0);
  
  const today = new Date();
  const endDate = new Date(targetSprint.endDate);
  const startDate = new Date(targetSprint.startDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  const idealPointsPerDay = plannedPoints / totalDays;
  const expectedRemaining = Math.max(0, plannedPoints - (idealPointsPerDay * daysElapsed));
  const actualRemaining = completedPoints + inProgressPoints;
  
  const historicalSprints = sprints.filter(s => s.status === "completed" && s.velocity !== undefined);
  const averageVelocity = historicalSprints.length > 0
    ? historicalSprints.reduce((sum, s) => sum + (s.velocity || 0), 0) / historicalSprints.length
    : 0;
  
  const report = {
    sprint: {
      id: targetSprint.id,
      name: targetSprint.name,
      goal: targetSprint.goal,
      status: targetSprint.status,
      startDate: targetSprint.startDate,
      endDate: targetSprint.endDate,
      days_remaining: daysRemaining,
    },
    items_summary: {
      total: sprintItems.length,
      todo: { count: todoItems.length, points: todoItems.reduce((sum, i) => sum + i.storyPoints, 0) },
      in_progress: { count: inProgressItems.length, points: inProgressPoints },
      done: { count: doneItems.length, points: completedPoints },
    },
    points_summary: {
      planned: plannedPoints,
      completed: completedPoints,
      remaining: plannedPoints - completedPoints,
      completion_rate: plannedPoints > 0 ? Math.round((completedPoints / plannedPoints) * 100) : 0,
    },
    burndown: targetSprint.burndown || [],
    velocity_trend: {
      current_sprint_velocity: targetSprint.velocity || completedPoints,
      average_velocity: Math.round(averageVelocity),
      prediction: Math.round(averageVelocity * 1.1),
    },
    health_indicators: {
      on_track: actualRemaining <= expectedRemaining,
      scope_change_risk: plannedPoints > (targetSprint.velocity || 0) * 1.2,
      blocked_items: sprintItems.filter(i => i.status === "in-progress").length,
    },
  };
  
  return {
    success: true,
    report,
    message: `Sprint report for "${targetSprint.name}" generated successfully.`,
  };
}

function setSprintGoal(args: { sprint_id?: string; goal?: string }, basePath: string) {
  if (!args.goal) {
    return { 
      success: false, 
      error: "Goal text is required." 
    };
  }
  
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  
  let targetSprint: Sprint | undefined;
  
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active" || s.status === "planning");
  }
  
  if (!targetSprint) {
    return { 
      success: false, 
      error: "No sprint found to set goal. Create a sprint first." 
    };
  }
  
  targetSprint.goal = args.goal;
  writeData(SPRINTS_FILE, sprints, basePath);
  
  return {
    success: true,
    sprint: {
      id: targetSprint.id,
      name: targetSprint.name,
      goal: targetSprint.goal,
    },
    message: `Sprint goal set for "${targetSprint.name}".`,
  };
}
