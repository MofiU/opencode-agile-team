import { tool } from "@opencode-ai/plugin";
import { 
  readData, 
  writeData, 
  generateId, 
  formatDate,
  type Demo,
  type ReviewFeedback,
  type Sprint 
} from "./storage.js";

const DEMOS_FILE = "demos.json";
const FEEDBACK_FILE = "review-feedback.json";
const SPRINTS_FILE = "sprints.json";

interface DemoInput {
  title: string;
  description?: string;
  url?: string;
  notes?: string;
}

interface FeedbackInput {
  type: "positive" | "concern" | "suggestion";
  content: string;
  author?: string;
}

interface ReviewContext {
  directory?: string;
}

export const reviewTool = tool({
  name: "review",
  description: "Conduct sprint review meeting",
  args: {
    action: tool.schema.enum(["start", "demo", "feedback", "report"]),
    demos: tool.schema.array(tool.schema.object({
      title: tool.schema.string(),
      description: tool.schema.string().optional(),
      url: tool.schema.string().optional(),
      notes: tool.schema.string().optional(),
    })).optional(),
    feedback: tool.schema.array(tool.schema.object({
      type: tool.schema.enum(["positive", "concern", "suggestion"]),
      content: tool.schema.string(),
      author: tool.schema.string().optional(),
    })).optional(),
  },
  async execute(args, ctx: ReviewContext) {
    const basePath = ctx.directory || "";
    
    switch (args.action) {
      case "start":
        return startReview(args, basePath);
      case "demo":
        return recordDemo(args, basePath);
      case "feedback":
        return collectFeedback(args, basePath);
      case "report":
        return generateReviewReport(args, basePath);
      default:
        return { success: false, error: `Unknown action: ${args.action}` };
    }
  },
});

function startReview(args: Record<string, never>, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const completedSprint = sprints.find(s => s.status === "completed") || sprints.find(s => s.status === "active");
  
  if (!completedSprint) {
    return { 
      success: false, 
      error: "No sprint found. Complete a sprint first to conduct a review." 
    };
  }
  
  const demos = readData<Demo[]>(DEMOS_FILE, basePath) || [];
  const sprintDemos = demos.filter(d => d.sprintId === completedSprint.id);
  
  return {
    success: true,
    review: {
      sprint_id: completedSprint.id,
      sprint_name: completedSprint.name,
      sprint_goal: completedSprint.goal,
      status: "in-progress",
      demos_scheduled: sprintDemos.length,
      prompt: `Sprint Review for "${completedSprint.name}".\nGoal: ${completedSprint.goal || "No goal set"}\n\nDemo your completed work and gather feedback.`,
    },
    message: `Sprint Review started for "${completedSprint.name}".`,
  };
}

function recordDemo(args: { demos?: DemoInput[] }, basePath: string) {
  const demosInput = args.demos;
  
  if (!demosInput || demosInput.length === 0) {
    return { 
      success: false, 
      error: "No demos provided. Pass 'demos' parameter with demo information." 
    };
  }
  
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const completedSprint = sprints.find(s => s.status === "completed") || sprints.find(s => s.status === "active");
  
  if (!completedSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const demos = readData<Demo[]>(DEMOS_FILE, basePath) || [];
  
  const newDemos: Demo[] = demosInput.map(demo => ({
    id: generateId(),
    sprintId: completedSprint.id,
    title: demo.title,
    description: demo.description || "",
    url: demo.url,
    notes: demo.notes || "",
    completedAt: formatDate(new Date()),
  }));
  
  demos.push(...newDemos);
  writeData(DEMOS_FILE, demos, basePath);
  
  return {
    success: true,
    demos_recorded: newDemos.length,
    demos: newDemos.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      url: d.url,
    })),
    message: `Recorded ${newDemos.length} demo(s) for sprint review.`,
  };
}

function collectFeedback(args: { feedback?: FeedbackInput[] }, basePath: string) {
  const feedbackInput = args.feedback;
  
  if (!feedbackInput || feedbackInput.length === 0) {
    return { 
      success: false, 
      error: "No feedback provided. Pass 'feedback' parameter with review feedback." 
    };
  }
  
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const completedSprint = sprints.find(s => s.status === "completed") || sprints.find(s => s.status === "active");
  
  if (!completedSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const feedback = readData<ReviewFeedback[]>(FEEDBACK_FILE, basePath) || [];
  
  const newFeedback: ReviewFeedback[] = feedbackInput.map(fb => ({
    id: generateId(),
    sprintId: completedSprint.id,
    type: fb.type,
    content: fb.content,
    author: fb.author || "anonymous",
    createdAt: formatDate(new Date()),
  }));
  
  feedback.push(...newFeedback);
  writeData(FEEDBACK_FILE, feedback, basePath);
  
  const grouped = {
    positive: newFeedback.filter(f => f.type === "positive").length,
    concern: newFeedback.filter(f => f.type === "concern").length,
    suggestion: newFeedback.filter(f => f.type === "suggestion").length,
  };
  
  return {
    success: true,
    feedback_collected: newFeedback.length,
    by_type: grouped,
    message: `Collected ${newFeedback.length} feedback item(s). ${grouped.concern} concern(s) need attention.`,
  };
}

function generateReviewReport(args: Record<string, never>, basePath: string) {
  const sprints = readData<Sprint[]>(SPRINTS_FILE, basePath) || [];
  const completedSprint = sprints.find(s => s.status === "completed") || sprints.find(s => s.status === "active");
  
  if (!completedSprint) {
    return { success: false, error: "No sprint found." };
  }
  
  const demos = readData<Demo[]>(DEMOS_FILE, basePath) || [];
  const feedback = readData<ReviewFeedback[]>(FEEDBACK_FILE, basePath) || [];
  
  const sprintDemos = demos.filter(d => d.sprintId === completedSprint.id);
  const sprintFeedback = feedback.filter(f => f.sprintId === completedSprint.id);
  
  const groupedFeedback = {
    positive: sprintFeedback.filter(f => f.type === "positive"),
    concern: sprintFeedback.filter(f => f.type === "concern"),
    suggestion: sprintFeedback.filter(f => f.type === "suggestion"),
  };
  
  const concernsNeedingAction = groupedFeedback.concern.filter(c => 
    !groupedFeedback.suggestion.some(s => s.content.toLowerCase().includes(c.content.toLowerCase().substring(0, 20)))
  );
  
  return {
    success: true,
    report: {
      sprint: {
        id: completedSprint.id,
        name: completedSprint.name,
        goal: completedSprint.goal,
        status: completedSprint.status,
      },
      demos: {
        total: sprintDemos.length,
        items: sprintDemos.map(d => ({
          id: d.id,
          title: d.title,
          description: d.description,
          url: d.url,
          notes: d.notes,
          completedAt: d.completedAt,
        })),
      },
      feedback: {
        total: sprintFeedback.length,
        positive_count: groupedFeedback.positive.length,
        concerns_count: groupedFeedback.concern.length,
        suggestions_count: groupedFeedback.suggestion.length,
        positive: groupedFeedback.positive.map(f => ({ content: f.content, author: f.author })),
        concerns: groupedFeedback.concern.map(f => ({ content: f.content, author: f.author, needs_action: true })),
        suggestions: groupedFeedback.suggestion.map(f => ({ content: f.content, author: f.author })),
      },
      summary: {
        overall_sentiment: groupedFeedback.positive.length > groupedFeedback.concern.length ? "positive" : "needs-attention",
        concerns_needing_action: concernsNeedingAction.length,
        demo_completion_rate: sprintDemos.length > 0 ? 100 : 0,
      },
    },
    message: `Sprint Review report for "${completedSprint.name}" generated.`,
  };
}
