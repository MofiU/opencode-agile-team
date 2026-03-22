import { tool } from "@opencode-ai/plugin";
import { 
  readData, 
  writeData, 
  generateId, 
  formatDate,
  type StandupEntry,
  type Sprint 
} from "./storage.js";

const STANDUPS_FILE = "standups.json";
const SPRINTS_FILE = "sprints.json";

interface StandupEntryInput {
  member: string;
  yesterday: string;
  today: string;
  blockers?: string[];
}

interface StandupContext {
  directory?: string;
}

export const standupTool = tool({
  name: "standup",
  description: "Run daily standup meeting",
  args: {
    action: tool.schema.enum(["start", "report", "summary", "blockers"]),
    entries: tool.schema.array(tool.schema.object({
      member: tool.schema.string(),
      yesterday: tool.schema.string(),
      today: tool.schema.string(),
      blockers: tool.schema.array(tool.schema.string()).optional(),
    })).optional(),
    format: tool.schema.enum(["three-questions", "update", "async"]).default("three-questions"),
  },
  async execute(args, ctx: StandupContext) {
    const basePath = ctx.directory || "";
    
    switch (args.action) {
      case "start":
        return startStandup(args, basePath);
      case "report":
        return submitReport(args, basePath);
      case "summary":
        return generateSummary(args, basePath);
      case "blockers":
        return listBlockers(args, basePath);
      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  },
});

function startStandup(args: { format?: string }, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const activeSprint = sprints.find(s => s.status === "active");
  
  const today = formatDate(new Date());
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  
  const todayStandups = standups.filter(s => s.date === today);
  
  let prompt = "";
  
  if (args.format === "async") {
    prompt = `Daily standup started for ${today}. Please submit your update using the 'report' action.`;
  } else if (args.format === "update") {
    prompt = `Daily standup started for ${today}. Share your progress update.`;
  } else {
    prompt = `Daily standup started for ${today}. Please answer:\n1. What did you accomplish yesterday?\n2. What will you work on today?\n3. Any blockers?`;
  }
  
  return {
    success: true,
    standup: {
      date: today,
      format: args.format || "three-questions",
      active_sprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name, goal: activeSprint.goal } : null,
      submissions_received: todayStandups.length,
      prompt,
    },
    message: prompt,
  };
}

function submitReport(args: { entries?: StandupEntryInput[] }, basePath: string) {
  const entries = args.entries;
  
  if (!entries || entries.length === 0) {
    return { 
      success: false, 
      error: "No entries provided. Pass 'entries' parameter with standup updates." 
    };
  }
  
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  const today = formatDate(new Date());
  
  const newEntries: StandupEntry[] = entries.map(entry => ({
    id: generateId(),
    date: today,
    member: entry.member,
    yesterday: entry.yesterday,
    today: entry.today,
    blockers: entry.blockers || [],
  }));
  
  standups.push(...newEntries);
  writeData(STANDUPS_FILE, standups, basePath);
  
  const allBlockers = newEntries.flatMap(e => e.blockers);
  
  return {
    success: true,
    submitted_count: newEntries.length,
    entries: newEntries.map(e => ({
      id: e.id,
      member: e.member,
      blockers: e.blockers,
    })),
    message: `Received ${newEntries.length} standup update(s). ${allBlockers.length > 0 ? `${allBlockers.length} blocker(s) reported.` : "No blockers reported."}`,
  };
}

function generateSummary(args: Record<string, never>, basePath: string) {
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const activeSprint = sprints.find(s => s.status === "active");
  
  const today = formatDate(new Date());
  const todayStandups = standups.filter(s => s.date === today);
  
  if (todayStandups.length === 0) {
    return {
      success: false,
      error: "No standup entries found for today. Run 'standup start' first.",
    };
  }
  
  const allBlockers = todayStandups.flatMap(s => s.blockers);
  const uniqueBlockers = [...new Set(allBlockers)];
  
  const summary = {
    date: today,
    active_sprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name, goal: activeSprint.goal } : null,
    participants: todayStandups.map(s => s.member),
    participation_count: todayStandups.length,
    updates: todayStandups.map(s => ({
      member: s.member,
      yesterday: s.yesterday,
      today: s.today,
      has_blockers: s.blockers.length > 0,
    })),
    blockers: uniqueBlockers.map(b => ({
      description: b,
      reported_by: todayStandups.filter(s => s.blockers.includes(b)).map(s => s.member),
    })),
    total_blockers: uniqueBlockers.length,
  };
  
  return {
    success: true,
    summary,
    message: `Standup summary for ${today}: ${todayStandups.length} participant(s), ${uniqueBlockers.length} unique blocker(s).`,
  };
}

function listBlockers(args: Record<string, never>, basePath: string) {
  const standups = readData<StandupEntry[]>(STANDUPS_FILE, basePath) || [];
  
  const allBlockers = standups.flatMap(s => s.blockers);
  
  if (allBlockers.length === 0) {
    return {
      success: true,
      blockers: [],
      message: "No blockers reported in any standup.",
    };
  }
  
  const blockerCounts: Record<string, { count: number; dates: string[]; members: string[] }> = {};
  
  for (const blocker of allBlockers) {
    const standup = standups.find(s => s.blockers.includes(blocker));
    if (!blockerCounts[blocker]) {
      blockerCounts[blocker] = { count: 0, dates: [], members: [] };
    }
    blockerCounts[blocker].count++;
    if (standup && !blockerCounts[blocker].dates.includes(standup.date)) {
      blockerCounts[blocker].dates.push(standup.date);
    }
    if (standup && !blockerCounts[blocker].members.includes(standup.member)) {
      blockerCounts[blocker].members.push(standup.member);
    }
  }
  
  const sortedBlockers = Object.entries(blockerCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([description, data]) => ({
      description,
      occurrence_count: data.count,
      first_reported: data.dates.sort()[0],
      latest_reported: data.dates.sort()[data.dates.length - 1],
      reported_by: data.members,
      is_persistent: data.count > 1,
    }));
  
  const activeBlockers = sortedBlockers.filter(b => b.is_persistent);
  const resolvedBlockers = sortedBlockers.filter(b => !b.is_persistent);
  
  return {
    success: true,
    blockers: sortedBlockers,
    summary: {
      total_unique_blockers: sortedBlockers.length,
      active_blockers: activeBlockers.length,
      resolved_blockers: resolvedBlockers.length,
    },
    message: `Found ${sortedBlockers.length} unique blocker(s). ${activeBlockers.length} are persistent and need attention.`,
  };
}
