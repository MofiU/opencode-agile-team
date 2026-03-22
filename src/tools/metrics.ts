import { tool } from "@opencode-ai/plugin";
import { 
  readData,
  formatDate,
  type Sprint,
  type BacklogItem,
  type StandupEntry,
  type Metrics,
  type QualityMetrics
} from "./storage.js";

const SPRINTS_FILE = "sprints.json";
const BACKLOG_FILE = "backlog.json";
const STANDUPS_FILE = "standups.json";

interface MetricsContext {
  directory?: string;
}

export const metricsTool = tool({
  name: "metrics",
  description: "Track and report team metrics",
  args: {
    action: tool.schema.enum(["velocity", "sprint-health", "quality", "blockers", "report"]),
    sprint_id: tool.schema.string().optional(),
    data: tool.schema.object({
      bugCount: tool.schema.number().optional(),
      escapedBugs: tool.schema.number().optional(),
      codeCoverage: tool.schema.number().optional(),
      technicalDebt: tool.schema.number().optional(),
    }).optional(),
  },
  async execute(args, ctx: MetricsContext) {
    const basePath = ctx.directory || "";
    
    switch (args.action) {
      case "velocity":
        return calculateVelocity(args, basePath);
      case "sprint-health":
        return calculateSprintHealth(args, basePath);
      case "quality":
        return trackQuality(args, basePath);
      case "blockers":
        return trackBlockers(args, basePath);
      case "report":
        return generateFullReport(args, basePath);
      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  },
});

function calculateVelocity(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const backlogItems = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  
  const completedSprints = sprints.filter(s => s.status === "completed");
  
  if (completedSprints.length === 0) {
    return {
      success: true,
      velocity: {
        current_sprint: null,
        average: 0,
        trend: "no-data",
        history: [],
      },
      message: "No completed sprints to calculate velocity from.",
    };
  }
  
  let targetSprint: Sprint | undefined;
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active") || completedSprints[completedSprints.length - 1];
  }
  
  const velocities = completedSprints
    .filter(s => s.velocity !== undefined)
    .map(s => ({ sprintId: s.id, sprintName: s.name, velocity: s.velocity || 0 }));
  
  const averageVelocity = velocities.reduce((sum, v) => sum + v.velocity, 0) / velocities.length;
  
  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (velocities.length >= 2) {
    const recent = velocities[velocities.length - 1].velocity;
    const previous = velocities[velocities.length - 2].velocity;
    if (recent > previous * 1.1) {
      trend = "increasing";
    } else if (recent < previous * 0.9) {
      trend = "decreasing";
    }
  }
  
  let currentSprintVelocity: number | null = null;
  let currentSprintItems: BacklogItem[] = [];
  
  if (targetSprint) {
    currentSprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
    const completedItems = currentSprintItems.filter(item => item.status === "done");
    currentSprintVelocity = completedItems.reduce((sum, item) => sum + item.storyPoints, 0);
  }
  
  return {
    success: true,
    velocity: {
      current_sprint: targetSprint ? {
        id: targetSprint.id,
        name: targetSprint.name,
        status: targetSprint.status,
        velocity: currentSprintVelocity,
        planned: currentSprintItems.reduce((sum, i) => sum + i.storyPoints, 0),
        completion_rate: currentSprintItems.length > 0 
          ? Math.round((currentSprintItems.filter(i => i.status === "done").length / currentSprintItems.length) * 100)
          : 0,
      } : null,
      average: Math.round(averageVelocity),
      trend,
      history: velocities,
      prediction: Math.round(averageVelocity * 1.1),
    },
    message: `Velocity calculated from ${velocities.length} completed sprint(s). Average: ${Math.round(averageVelocity)} points.`,
  };
}

function calculateSprintHealth(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const backlogItems = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  
  let targetSprint: Sprint | undefined;
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active");
  }
  
  if (!targetSprint) {
    return { success: false, error: "No active sprint found." };
  }
  
  const sprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
  const todoItems = sprintItems.filter(i => i.status === "todo");
  const inProgressItems = sprintItems.filter(i => i.status === "in-progress");
  const doneItems = sprintItems.filter(i => i.status === "done");
  
  const today = new Date();
  const endDate = new Date(targetSprint.endDate);
  const startDate = new Date(targetSprint.startDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  const plannedPoints = sprintItems.reduce((sum, i) => sum + i.storyPoints, 0);
  const completedPoints = doneItems.reduce((sum, i) => sum + i.storyPoints, 0);
  const remainingPoints = plannedPoints - completedPoints;
  
  const idealProgress = (daysElapsed / totalDays) * plannedPoints;
  const progressDiff = completedPoints - idealProgress;
  
  const sprintBlockers = standups.filter(s => {
    const standupDate = new Date(s.date);
    return standupDate >= startDate && standupDate <= today && s.blockers.length > 0;
  });
  const uniqueBlockers = [...new Set(sprintBlockers.flatMap(b => b.blockers))];
  
  const indicators = {
    scope_health: plannedPoints <= (targetSprint.velocity || completedPoints) * 1.3 ? "good" : "at-risk",
    schedule_health: daysRemaining >= (remainingPoints / (completedPoints / Math.max(1, daysElapsed))) ? "good" : "at-risk",
    blocker_health: uniqueBlockers.length <= 2 ? "good" : uniqueBlockers.length <= 5 ? "warning" : "critical",
    progress_health: progressDiff >= -plannedPoints * 0.1 ? "good" : "at-risk",
  };
  
  const healthScore = Object.values(indicators).filter(v => v === "good").length / 4;
  
  return {
    success: true,
    health: {
      sprint: {
        id: targetSprint.id,
        name: targetSprint.name,
        status: targetSprint.status,
        days_remaining: daysRemaining,
        start_date: targetSprint.startDate,
        end_date: targetSprint.endDate,
      },
      items_summary: {
        total: sprintItems.length,
        todo: todoItems.length,
        in_progress: inProgressItems.length,
        done: doneItems.length,
      },
      points_summary: {
        planned: plannedPoints,
        completed: completedPoints,
        remaining: remainingPoints,
        completion_rate: plannedPoints > 0 ? Math.round((completedPoints / plannedPoints) * 100) : 0,
      },
      indicators,
      overall_score: Math.round(healthScore * 100),
      status: healthScore >= 0.75 ? "healthy" : healthScore >= 0.5 ? "warning" : "critical",
    },
    message: `Sprint health score: ${Math.round(healthScore * 100)}% - ${healthScore >= 0.75 ? "healthy" : healthScore >= 0.5 ? "needs attention" : "critical"}`,
  };
}

function trackQuality(args: { sprint_id?: string; data?: QualityMetrics }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const backlogItems = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  
  let targetSprint: Sprint | undefined;
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active") || sprints.find(s => s.status === "completed");
  }
  
  if (!targetSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const sprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
  const completedItems = sprintItems.filter(i => i.status === "done");
  
  const bugCount = args.data?.bugCount ?? 0;
  const escapedBugs = args.data?.escapedBugs ?? 0;
  const codeCoverage = args.data?.codeCoverage;
  const technicalDebt = args.data?.technicalDebt;
  
  const defectRate = completedItems.length > 0 
    ? Math.round((bugCount / completedItems.length) * 100) 
    : 0;
  
  const qualityIndex = calculateQualityIndex({
    defectRate,
    escapedBugs,
    codeCoverage,
    technicalDebt,
  });
  
  return {
    success: true,
    quality: {
      sprint: {
        id: targetSprint.id,
        name: targetSprint.name,
        completed_items: completedItems.length,
      },
      metrics: {
        bugs_identified: bugCount,
        escaped_bugs: escapedBugs,
        defect_rate: defectRate,
        code_coverage: codeCoverage,
        technical_debt_hours: technicalDebt,
      },
      quality_index: Math.round(qualityIndex),
      status: qualityIndex >= 80 ? "excellent" : qualityIndex >= 60 ? "good" : qualityIndex >= 40 ? "needs-improvement" : "poor",
    },
    message: `Quality metrics recorded. Quality index: ${Math.round(qualityIndex)}/100.`,
  };
}

function calculateQualityIndex(metrics: {
  defectRate: number;
  escapedBugs: number;
  codeCoverage?: number;
  technicalDebt?: number;
}): number {
  let score = 100;
  
  score -= metrics.defectRate * 2;
  score -= metrics.escapedBugs * 5;
  
  if (metrics.codeCoverage !== undefined) {
    score = (score * 0.4) + (metrics.codeCoverage * 0.6);
  }
  
  if (metrics.technicalDebt !== undefined && metrics.technicalDebt > 0) {
    score -= Math.min(20, metrics.technicalDebt / 4);
  }
  
  return Math.max(0, Math.min(100, score));
}

function trackBlockers(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  
  let targetSprint: Sprint | undefined;
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active");
  }
  
  if (!targetSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const startDate = new Date(targetSprint.startDate);
  const endDate = targetSprint.status === "active" ? new Date() : new Date(targetSprint.endDate);
  
  const sprintStandups = standups.filter(s => {
    const date = new Date(s.date);
    return date >= startDate && date <= endDate;
  });
  
  const blockerCounts: Record<string, { count: number; firstSeen: string; lastSeen: string; members: string[] }> = {};
  
  for (const standup of sprintStandups) {
    for (const blocker of standup.blockers) {
      if (!blockerCounts[blocker]) {
        blockerCounts[blocker] = { count: 0, firstSeen: standup.date, lastSeen: standup.date, members: [] };
      }
      blockerCounts[blocker].count++;
      blockerCounts[blocker].lastSeen = standup.date;
      if (!blockerCounts[blocker].members.includes(standup.member)) {
        blockerCounts[blocker].members.push(standup.member);
      }
    }
  }
  
  const sortedBlockers = Object.entries(blockerCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([description, data]) => ({
      description,
      occurrence_count: data.count,
      first_seen: data.firstSeen,
      last_seen: data.lastSeen,
      reported_by: data.members,
      is_persistent: data.count > 1,
      age_days: Math.ceil((new Date(data.lastSeen).getTime() - new Date(data.firstSeen).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  
  const resolvedBlockers = sortedBlockers.filter(b => b.count === 1);
  const activeBlockers = sortedBlockers.filter(b => b.count > 1);
  
  const trend = activeBlockers.length === 0 ? "improving" 
    : activeBlockers.length <= 2 ? "stable" 
    : "worsening";
  
  return {
    success: true,
    blockers: {
      sprint: {
        id: targetSprint.id,
        name: targetSprint.name,
        status: targetSprint.status,
      },
      summary: {
        total_unique: sortedBlockers.length,
        resolved: resolvedBlockers.length,
        active: activeBlockers.length,
        trend,
      },
      active_blockers: activeBlockers,
      resolved_blockers: resolvedBlockers,
    },
    message: `${activeBlockers.length} persistent blocker(s) tracked. Trend: ${trend}.`,
  };
}

function generateFullReport(args: { sprint_id?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const backlogItems = readData<BacklogItem[]>(BACKLOG_FILE, basePath) || [];
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  
  let targetSprint: Sprint | undefined;
  if (args.sprint_id) {
    targetSprint = sprints.find(s => s.id === args.sprint_id);
  } else {
    targetSprint = sprints.find(s => s.status === "active") || sprints.find(s => s.status === "completed");
  }
  
  if (!targetSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const sprintItems = backlogItems.filter(item => item.sprintId === targetSprint!.id);
  const completedItems = sprintItems.filter(i => i.status === "done");
  const inProgressItems = sprintItems.filter(i => i.status === "in-progress");
  const todoItems = sprintItems.filter(i => i.status === "todo");
  
  const plannedPoints = sprintItems.reduce((sum, i) => sum + i.storyPoints, 0);
  const completedPoints = completedItems.reduce((sum, i) => sum + i.storyPoints, 0);
  
  const historicalSprints = sprints.filter(s => s.status === "completed" && s.velocity !== undefined);
  const averageVelocity = historicalSprints.length > 0
    ? historicalSprints.reduce((sum, s) => sum + (s.velocity || 0), 0) / historicalSprints.length
    : 0;
  
  const today = new Date();
  const endDate = new Date(targetSprint.endDate);
  const startDate = new Date(targetSprint.startDate);
  const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  const sprintStandups = standups.filter(s => {
    const date = new Date(s.date);
    return date >= startDate && date <= today;
  });
  const uniqueBlockers = [...new Set(sprintStandups.flatMap(b => b.blockers))];
  
  const idealProgress = (daysElapsed / (daysElapsed + daysRemaining)) * plannedPoints;
  const progressDiff = completedPoints - idealProgress;
  
  const healthScore = calculateHealthScore({
    plannedPoints,
    completedPoints,
    velocity: targetSprint.velocity || completedPoints,
    averageVelocity,
    daysRemaining,
    blockerCount: uniqueBlockers.length,
    progressDiff,
  });
  
  const report: Metrics = {
    sprintId: targetSprint.id,
    velocity: completedPoints,
    completedPoints,
    plannedPoints,
    addedPoints: 0,
    removedPoints: 0,
    blockerCount: uniqueBlockers.length,
    quality: {
      bugCount: 0,
      escapedBugs: 0,
    },
    generatedAt: formatDate(new Date()),
  };
  
  return {
    success: true,
    report: {
      sprint: {
        id: targetSprint.id,
        name: targetSprint.name,
        goal: targetSprint.goal,
        status: targetSprint.status,
        start_date: targetSprint.startDate,
        end_date: targetSprint.endDate,
        days_remaining: daysRemaining,
      },
      velocity: {
        current: completedPoints,
        planned: plannedPoints,
        average_historical: Math.round(averageVelocity),
        prediction: Math.round(averageVelocity * 1.1),
        on_track: progressDiff >= -plannedPoints * 0.1,
      },
      items: {
        total: sprintItems.length,
        completed: completedItems.length,
        in_progress: inProgressItems.length,
        todo: todoItems.length,
        completion_rate: sprintItems.length > 0 
          ? Math.round((completedItems.length / sprintItems.length) * 100) 
          : 0,
      },
      health: {
        score: healthScore,
        status: healthScore >= 75 ? "healthy" : healthScore >= 50 ? "warning" : "critical",
        indicators: {
          scope_stability: "good",
          schedule_status: daysRemaining > 0 ? "on-track" : "completed",
          blocker_level: uniqueBlockers.length <= 2 ? "low" : uniqueBlockers.length <= 5 ? "medium" : "high",
        },
      },
      trends: {
        velocity_trend: historicalSprints.length >= 2 ? "stable" : "insufficient-data",
        blocker_trend: uniqueBlockers.length === 0 ? "clear" : "blocked",
      },
    },
    message: `Comprehensive metrics report for "${targetSprint.name}". Health score: ${healthScore}%.`,
  };
}

function calculateHealthScore(params: {
  plannedPoints: number;
  completedPoints: number;
  velocity: number;
  averageVelocity: number;
  daysRemaining: number;
  blockerCount: number;
  progressDiff: number;
}): number {
  let score = 100;
  
  if (params.plannedPoints > 0) {
    const completionRatio = params.completedPoints / params.plannedPoints;
    if (completionRatio < 0.5) score -= 20;
    else if (completionRatio < 0.75) score -= 10;
  }
  
  if (params.velocity > params.averageVelocity * 1.2) score += 5;
  else if (params.velocity < params.averageVelocity * 0.8) score -= 10;
  
  if (params.progressDiff < -params.plannedPoints * 0.2) score -= 20;
  else if (params.progressDiff < 0) score -= 10;
  
  if (params.blockerCount > 5) score -= 25;
  else if (params.blockerCount > 2) score -= 10;
  else if (params.blockerCount === 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}
