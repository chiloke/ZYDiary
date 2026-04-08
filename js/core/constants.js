import { formatDateKey, startOfDay } from "./utils.js";

export const DB_NAME = "zy-diary-db";
export const DB_VERSION = 1;
export const STORE_NAME = "app";
export const STATE_KEY = "state";
export const LEGACY_KEY = "zy-diary-state";
export const RECOVERY_SNAPSHOT_KEY = "zy-diary-recovery-snapshot";
export const SCHEMA_VERSION = 5;
export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
export const THEME_OPTIONS = [
  { value: "dawn", label: "晨雾米金" },
  { value: "ink", label: "夜墨青金" }
];

export const REALMS = [
  { name: "练气一重", aura: 0, ability: "开启每日复盘" },
  { name: "练气三重", aura: 5, ability: "解锁目标奖励转盘" },
  { name: "练气六重", aura: 12, ability: "解锁多目标修行视图" },
  { name: "练气九重", aura: 20, ability: "解锁消费图表洞察" },
  { name: "筑基一重", aura: 32, ability: "解锁境界形象升级" },
  { name: "筑基三重", aura: 48, ability: "解锁长期习惯专注模式" },
  { name: "结丹初期", aura: 68, ability: "解锁阶段性里程碑记录" },
  { name: "元婴初期", aura: 95, ability: "解锁年度回望仪式" },
  { name: "化神初期", aura: 132, ability: "解锁全域修行总览" },
  { name: "炼虚初期", aura: 176, ability: "解锁年度目标脉络视图" },
  { name: "合体初期", aura: 228, ability: "解锁长期习惯组联动" },
  { name: "大乘初期", aura: 292, ability: "解锁高阶回顾仪式" },
  { name: "渡劫初期", aura: 368, ability: "解锁阶段成就铭刻" },
  { name: "准圣", aura: 456, ability: "解锁修行流派称号槽" },
  { name: "半圣", aura: 560, ability: "解锁全局长期主义刻印" },
  { name: "圣人", aura: 680, ability: "解锁终局修行总谱" }
];

export function getDefaultState(now = new Date()) {
  const today = startOfDay(now);

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: "",
      lastImportedAt: "",
      updatedAt: "",
      reminderLog: {},
      helpOpenedAt: ""
    },
    activeGoalId: "run",
    calendarView: { year: today.getFullYear(), month: today.getMonth() },
    reviewCalendarView: { year: today.getFullYear(), month: today.getMonth() },
    visit: { lastDate: "", streak: 0 },
    review: { win: "", block: "", next: "", summary: "", savedAt: "", rewardedDate: "" },
    reviewEntries: [],
    annotations: [],
    goals: [],
    expenses: [],
    recurringExpenses: [],
    budgets: {},
    goalLogs: [],
    auraEvents: {},
    settings: {
      animationsEnabled: true,
      username: "修行者",
      theme: "dawn",
      reminders: {
        enabled: true,
        daily: true,
        dailyTime: "21:30",
        goals: true,
        goalsTime: "20:30",
        recurring: true,
        recurringTime: "10:00"
      },
      onboarding: {
        dismissed: false
      }
    }
  };
}
