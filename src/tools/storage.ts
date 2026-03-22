import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const AGILE_DIR = ".agile";

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: "planning" | "active" | "completed";
  velocity?: number;
  burndown?: BurndownEntry[];
}

export interface BurndownEntry {
  date: string;
  remaining: number;
  ideal: number;
}

export interface BacklogItem {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: number;
  status: "todo" | "in-progress" | "done" | "removed";
  sprintId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StandupEntry {
  id: string;
  date: string;
  member: string;
  yesterday: string;
  today: string;
  blockers: string[];
}

export interface RetroEntry {
  id: string;
  sprintId: string;
  type: "start" | "stop" | "continue" | "lesson" | "plus" | "delta" | "anchor" | "mad" | "sad" | "glad";
  content: string;
  votes: number;
  author: string;
}

export interface RetroAction {
  id: string;
  retroId: string;
  description: string;
  owner: string;
  status: "open" | "done";
  createdAt: string;
}

export interface Demo {
  id: string;
  sprintId: string;
  title: string;
  description: string;
  url?: string;
  notes: string;
  completedAt: string;
}

export interface ReviewFeedback {
  id: string;
  sprintId: string;
  type: "positive" | "concern" | "suggestion";
  content: string;
  author: string;
  createdAt: string;
}

export interface Metrics {
  sprintId: string;
  velocity: number;
  completedPoints: number;
  plannedPoints: number;
  addedPoints: number;
  removedPoints: number;
  blockerCount: number;
  quality: QualityMetrics;
  generatedAt: string;
}

export interface QualityMetrics {
  bugCount: number;
  escapedBugs: number;
  codeCoverage?: number;
  technicalDebt?: number;
}

function ensureAgileDir(basePath: string = ""): void {
  const dir = basePath ? join(basePath, AGILE_DIR) : AGILE_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getFilePath(filename: string, basePath: string = ""): string {
  const dir = basePath ? join(basePath, AGILE_DIR) : AGILE_DIR;
  return join(dir, filename);
}

export function readData<T>(filename: string, basePath: string = ""): T | null {
  try {
    const filePath = getFilePath(filename, basePath);
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function writeData<T>(filename: string, data: T, basePath: string = ""): void {
  ensureAgileDir(basePath);
  const filePath = getFilePath(filename, basePath);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}
