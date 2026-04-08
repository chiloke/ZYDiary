(function () {
export function $(selector) {
  return document.querySelector(selector);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return startOfDay(result);
}

function diffDays(left, right) {
  return Math.round((startOfDay(right) - startOfDay(left)) / 86400000);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}`;
}

function formatDisplayDate(date) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${weekdays[date.getDay()]}`;
}

function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function millisecondsUntil(target, date) {
  return Math.max(0, target - date);
}

function timeUntilEndOfDay(date) {
  return millisecondsUntil(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1), date);
}

function timeUntilEndOfMonth(date) {
  return millisecondsUntil(new Date(date.getFullYear(), date.getMonth() + 1, 1), date);
}

function timeUntilEndOfYear(date) {
  return millisecondsUntil(new Date(date.getFullYear() + 1, 0, 1), date);
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shorten(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 48);
}

import { formatDateKey, startOfDay } from "./utils.js";

const DB_NAME = "zy-diary-db";
const DB_VERSION = 1;
const STORE_NAME = "app";
const STATE_KEY = "state";
const LEGACY_KEY = "zy-diary-state";
const RECOVERY_SNAPSHOT_KEY = "zy-diary-recovery-snapshot";
const SCHEMA_VERSION = 5;
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const THEME_OPTIONS = [
  { value: "dawn", label: "晨雾米金" },
  { value: "ink", label: "夜墨青金" }
];

const REALMS = [
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

function createGoalSeed(id, name, type, days, rewardPool, penaltyPool, currentDate) {
  return {
    id,
    name,
    type,
    completedDates: days.map((day) => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`),
    rewardPool,
    penaltyPool
  };
}

function getDefaultState(now = new Date()) {
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

import { REALMS, SCHEMA_VERSION, getDefaultState } from "./constants.js";

function normalizeGoal(goal) {
  const now = new Date();
  const normalized = {
    ...goal,
    rewardPool: Array.isArray(goal.rewardPool) && goal.rewardPool.length ? goal.rewardPool : ["今晚可以自由安排 30 分钟"],
    penaltyPool: Array.isArray(goal.penaltyPool) && goal.penaltyPool.length ? goal.penaltyPool : ["补做 10 分钟复盘"]
  };

  if (!Array.isArray(normalized.completedDates)) {
    normalized.completedDates = Array.isArray(goal.completedDays)
      ? goal.completedDays.map((day) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
      : [];
  }

  normalized.completedDates = [...new Set(normalized.completedDates)].sort();
  normalized.streakMeta = computeStreakMeta(normalized.completedDates);
  return normalized;
}

function sortGoalLogs(goalLogs = []) {
  return [...goalLogs].sort((left, right) => right.date.localeCompare(left.date));
}

function buildGoalLogsFromGoals(goals = []) {
  return goals.flatMap((goal) =>
    (goal.completedDates || []).map((dateKey) => ({
      id: `goal-log-${goal.id}-${dateKey}`,
      goalId: goal.id,
      date: dateKey,
      status: "done"
    }))
  );
}

function applyGoalLogsToGoals(goals, goalLogs) {
  const grouped = goalLogs.reduce((accumulator, log) => {
    if (log.status !== "done") return accumulator;
    accumulator[log.goalId] = accumulator[log.goalId] || [];
    accumulator[log.goalId].push(log.date);
    return accumulator;
  }, {});

  return goals.map((goal) => {
    const completedDates = [...new Set(grouped[goal.id] || [])].sort();
    return {
      ...goal,
      completedDates,
      streakMeta: computeStreakMeta(completedDates)
    };
  });
}

function migrateLegacyState(state, now = new Date()) {
  const next = clone(state);
  next.meta = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: next.meta?.exportedAt || "",
    lastImportedAt: next.meta?.lastImportedAt || "",
    updatedAt: next.meta?.updatedAt || "",
    reminderLog: next.meta?.reminderLog && typeof next.meta.reminderLog === "object" ? next.meta.reminderLog : {},
    helpOpenedAt: next.meta?.helpOpenedAt || ""
  };
  next.calendarView = next.calendarView || { year: now.getFullYear(), month: now.getMonth() };
  next.reviewCalendarView = next.reviewCalendarView || { year: now.getFullYear(), month: now.getMonth() };
  next.visit = next.visit || { lastDate: "", streak: 0 };
  next.review = next.review || { win: "", block: "", next: "", summary: "", savedAt: "", rewardedDate: "" };
  next.reviewEntries = Array.isArray(next.reviewEntries) ? next.reviewEntries : [];
  next.goalLogs = Array.isArray(next.goalLogs) ? next.goalLogs : [];
  next.budgets = next.budgets && typeof next.budgets === "object" ? next.budgets : {};
  next.annotations = Array.isArray(next.annotations) ? next.annotations : [];
  next.expenses = Array.isArray(next.expenses) ? next.expenses : [];
  next.recurringExpenses = Array.isArray(next.recurringExpenses) ? next.recurringExpenses : [];
  next.auraEvents = next.auraEvents || {};
  next.goals = (Array.isArray(next.goals) ? next.goals : []).map(normalizeGoal);
  next.settings = {
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
      recurringTime: "10:00",
      ...((next.settings || {}).reminders || {})
    },
    onboarding: {
      dismissed: false,
      ...((next.settings || {}).onboarding || {})
    },
    ...(next.settings || {})
  };

  if (!next.reviewEntries.length && next.review.savedAt) {
    next.reviewEntries.push({
      id: `review-entry-${next.review.savedAt}`,
      date: next.review.savedAt.slice(0, 10),
      win: next.review.win || "",
      block: next.review.block || "",
      next: next.review.next || "",
      summary: next.review.summary || buildReviewSummary(next.review.win || "", next.review.block || "", next.review.next || ""),
      savedAt: next.review.savedAt
    });
  }

  next.reviewEntries = next.reviewEntries
    .filter((entry) => entry && entry.date)
    .map((entry) => ({
      id: entry.id || `review-entry-${entry.date}`,
      date: entry.date,
      win: entry.win || "",
      block: entry.block || "",
      next: entry.next || "",
      mood: entry.mood || "平静",
      energy: entry.energy || "稳定",
      focus: entry.focus || "专注",
      summary: entry.summary || buildReviewSummary(entry.win || "", entry.block || "", entry.next || ""),
      savedAt: entry.savedAt || `${entry.date} 21:00`
    }))
    .sort((left, right) => right.date.localeCompare(left.date));

  next.recurringExpenses = next.recurringExpenses
    .filter((item) => item && item.title && item.category)
    .map((item) => ({
      id: item.id || `recurring-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title: item.title,
      category: item.category,
      amount: Number(item.amount) || 0,
      day: Math.min(28, Math.max(1, Number(item.day) || 1))
    }));

  if (!next.goalLogs.length) {
    next.goalLogs = buildGoalLogsFromGoals(next.goals);
  }

  next.goalLogs = sortGoalLogs(
    next.goalLogs
      .filter((log) => log && log.goalId && log.date)
      .map((log) => ({
        id: log.id || `goal-log-${log.goalId}-${log.date}`,
        goalId: log.goalId,
        date: log.date,
        status: log.status || "done"
      }))
  );

  next.goals = applyGoalLogsToGoals(next.goals, next.goalLogs);

  return next;
}

function mergeState(persisted, now = new Date()) {
  const defaults = getDefaultState(now);
  const merged = {
    ...clone(defaults),
    ...persisted,
    meta: { ...defaults.meta, ...(persisted.meta || {}), schemaVersion: SCHEMA_VERSION },
    calendarView: { ...defaults.calendarView, ...(persisted.calendarView || {}) },
    reviewCalendarView: { ...defaults.reviewCalendarView, ...(persisted.reviewCalendarView || {}) },
    visit: { ...defaults.visit, ...(persisted.visit || {}) },
    review: { ...defaults.review, ...(persisted.review || {}) },
    settings: { ...defaults.settings, ...(persisted.settings || {}) },
    reviewEntries: persisted.reviewEntries || clone(defaults.reviewEntries),
    goalLogs: persisted.goalLogs || clone(defaults.goalLogs),
    budgets: persisted.budgets || clone(defaults.budgets),
    annotations: persisted.annotations || clone(defaults.annotations),
    expenses: persisted.expenses || clone(defaults.expenses),
    recurringExpenses: persisted.recurringExpenses || clone(defaults.recurringExpenses),
    auraEvents: persisted.auraEvents || {},
    goals: (persisted.goals || clone(defaults.goals)).map(normalizeGoal)
  };

  return migrateLegacyState(merged, now);
}

function countCurrentStreak(completedDates, todayKey) {
  let cursor = parseDateKey(todayKey);
  let count = 0;
  while (completedDates.includes(formatDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function computeRepair(completedDates, todayKey) {
  const dates = completedDates.map(parseDateKey).sort((left, right) => left - right);
  if (!dates.length) return { active: false, base: 0, progress: 0, lastCheckin: "" };

  let tail = 1;
  for (let index = dates.length - 1; index > 0; index -= 1) {
    if (diffDays(dates[index - 1], dates[index]) === 1) {
      tail += 1;
    } else {
      break;
    }
  }

  const today = parseDateKey(todayKey);
  const last = dates[dates.length - 1];
  const gap = diffDays(last, today);
  if (gap <= 1) return { active: false, base: 0, progress: 0, lastCheckin: formatDateKey(last) };

  let bestBeforeBreak = 0;
  let run = 1;
  for (let index = 1; index < dates.length - tail; index += 1) {
    run = diffDays(dates[index - 1], dates[index]) === 1 ? run + 1 : 1;
    bestBeforeBreak = Math.max(bestBeforeBreak, run);
  }
  bestBeforeBreak = Math.max(bestBeforeBreak, run);

  return { active: tail < 3, base: bestBeforeBreak, progress: Math.min(tail, 3), lastCheckin: formatDateKey(last) };
}

function computeStreakMeta(completedDates, todayKey = formatDateKey(startOfDay(new Date()))) {
  const dates = completedDates.map(parseDateKey).sort((left, right) => left - right);
  let best = 0;
  let run = 0;

  for (let index = 0; index < dates.length; index += 1) {
    run = index === 0 || diffDays(dates[index - 1], dates[index]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  return {
    current: countCurrentStreak(completedDates, todayKey),
    best,
    repair: computeRepair(completedDates, todayKey)
  };
}

function syncVisitStreak(state, todayKey) {
  const today = parseDateKey(todayKey);
  const last = state.visit.lastDate;
  if (!last) {
    state.visit.lastDate = todayKey;
    state.visit.streak = 1;
    return;
  }

  const distance = diffDays(parseDateKey(last), today);
  if (distance === 0) return;
  if (distance === 1) {
    state.visit.lastDate = todayKey;
    state.visit.streak += 1;
    return;
  }
  state.visit.lastDate = todayKey;
  state.visit.streak = 1;
}

function setAuraEvent(state, id, amount, label, todayKey) {
  state.auraEvents[id] = { amount, label, date: todayKey };
}

function removeAuraEvent(state, id) {
  delete state.auraEvents[id];
}

function syncAllGoalsBonus(state, todayKey) {
  const allDone = state.goals.length > 0 && state.goals.every((goal) => goal.completedDates.includes(todayKey));
  if (allDone) {
    setAuraEvent(state, `all-goals-${todayKey}`, 3, "完成今日全部目标", todayKey);
  } else {
    removeAuraEvent(state, `all-goals-${todayKey}`);
  }
}

function getAuraSummary(state) {
  const events = Object.values(state.auraEvents);
  const total = events.reduce((sum, item) => sum + item.amount, 0);
  const realmIndex = REALMS.reduce((result, realm, index) => (total >= realm.aura ? index : result), 0);
  const currentRealm = REALMS[realmIndex];
  const nextRealm = REALMS[Math.min(realmIndex + 1, REALMS.length - 1)];
  const base = currentRealm.aura;
  const ceiling = nextRealm.aura;
  const progress = ceiling === base ? 100 : ((total - base) / (ceiling - base)) * 100;

  return { total, realmIndex, currentRealm, nextRealm, progress: Math.max(0, Math.min(progress, 100)) };
}

function buildReviewSummary(win, block, next) {
  const partA = win ? `今天推进最明显的是：${shorten(win)}。` : "今天还没有记录清晰的突破点。";
  const partB = block ? `主要阻碍集中在：${shorten(block)}。` : "今天没有记录明显阻碍，整体节奏相对稳定。";
  const partC = next ? `明天最值得优先处理的是：${shorten(next)}。` : "明天的优先事项还需要再明确一下。";

  let tone = "整体来看，这是适合继续稳步推进的一天。";
  if (win && next && !block) tone = "整体状态偏稳，可以沿着已有节奏继续放大优势。";
  if (block && next) tone = "最关键的不是自责，而是把阻碍拆成明天可执行的一步。";

  return `${partA}${partB}${partC}${tone}`;
}

function getReviewEntryByDate(state, dateKey) {
  return state.reviewEntries.find((entry) => entry.date === dateKey) || null;
}

function upsertReviewEntry(state, entry) {
  const nextEntry = {
    id: entry.id || `review-entry-${entry.date}`,
    date: entry.date,
    win: entry.win || "",
    block: entry.block || "",
    next: entry.next || "",
    mood: entry.mood || "平静",
    energy: entry.energy || "稳定",
    focus: entry.focus || "专注",
    summary: entry.summary || buildReviewSummary(entry.win || "", entry.block || "", entry.next || ""),
    savedAt: entry.savedAt || `${entry.date} 21:00`
  };

  const index = state.reviewEntries.findIndex((item) => item.date === nextEntry.date);
  if (index >= 0) {
    state.reviewEntries[index] = nextEntry;
  } else {
    state.reviewEntries.unshift(nextEntry);
  }

  state.reviewEntries.sort((left, right) => right.date.localeCompare(left.date));
  state.review = {
    win: nextEntry.win,
    block: nextEntry.block,
    next: nextEntry.next,
    summary: nextEntry.summary,
    savedAt: nextEntry.savedAt,
    rewardedDate: state.review.rewardedDate || ""
  };

  return nextEntry;
}

function getRecentReviewEntries(state, limit = 6) {
  return state.reviewEntries.slice(0, limit);
}

function getGoalCompletedDates(state, goalId) {
  return state.goalLogs
    .filter((log) => log.goalId === goalId && log.status === "done")
    .map((log) => log.date)
    .sort();
}

function updateGoal(state, goalId, updates) {
  state.goals = state.goals.map((goal) =>
    goal.id === goalId
      ? normalizeGoal({
          ...goal,
          ...updates,
          completedDates: goal.completedDates
        })
      : goal
  );
}

function deleteGoal(state, goalId) {
  state.goals = state.goals.filter((goal) => goal.id !== goalId);
  state.goalLogs = state.goalLogs.filter((log) => log.goalId !== goalId);
  Object.keys(state.auraEvents).forEach((key) => {
    if (key.startsWith(`goal-${goalId}-`)) {
      delete state.auraEvents[key];
    }
  });
  state.goals = applyGoalLogsToGoals(state.goals, state.goalLogs);
  if (state.activeGoalId === goalId) {
    state.activeGoalId = state.goals[0]?.id || "";
  }
}

function isGoalDoneOnDate(state, goalId, dateKey) {
  return state.goalLogs.some((log) => log.goalId === goalId && log.date === dateKey && log.status === "done");
}

function toggleGoalLog(state, goalId, dateKey, todayKey = dateKey) {
  const existingIndex = state.goalLogs.findIndex((log) => log.goalId === goalId && log.date === dateKey && log.status === "done");
  let doneToday = false;

  if (existingIndex >= 0) {
    state.goalLogs.splice(existingIndex, 1);
    doneToday = false;
  } else {
    state.goalLogs.unshift({
      id: `goal-log-${goalId}-${dateKey}`,
      goalId,
      date: dateKey,
      status: "done"
    });
    doneToday = true;
  }

  state.goalLogs = sortGoalLogs(state.goalLogs);
  state.goals = applyGoalLogsToGoals(state.goals, state.goalLogs).map((goal) =>
    goal.id === goalId ? { ...goal, streakMeta: computeStreakMeta(goal.completedDates, todayKey) } : goal
  );

  return doneToday;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getBudgetForMonth(state, monthKey) {
  return state.budgets[monthKey] || { total: 0, categories: {} };
}

function setBudgetForMonth(state, monthKey, budget) {
  state.budgets[monthKey] = {
    total: Number(budget.total) || 0,
    categories: {
      饮食: Number(budget.categories?.饮食) || 0,
      学习: Number(budget.categories?.学习) || 0,
      出行: Number(budget.categories?.出行) || 0,
      娱乐: Number(budget.categories?.娱乐) || 0,
      生活: Number(budget.categories?.生活) || 0
    }
  };
}

function upsertRecurringExpense(state, item) {
  const nextItem = {
    id: item.id || `recurring-${Date.now()}`,
    title: item.title || "",
    category: item.category || "生活",
    amount: Number(item.amount) || 0,
    day: Math.min(28, Math.max(1, Number(item.day) || 1))
  };
  const index = state.recurringExpenses.findIndex((entry) => entry.id === nextItem.id);
  if (index >= 0) {
    state.recurringExpenses[index] = nextItem;
  } else {
    state.recurringExpenses.unshift(nextItem);
  }
  return nextItem;
}

function deleteRecurringExpense(state, recurringId) {
  state.recurringExpenses = state.recurringExpenses.filter((item) => item.id !== recurringId);
}

function syncRecurringExpensesForMonth(state, date = new Date()) {
  const monthKey = getMonthKey(date);
  const year = date.getFullYear();
  const month = date.getMonth();
  let changed = false;

  state.recurringExpenses.forEach((item) => {
    const dateKey = formatDateKey(new Date(year, month, Math.min(item.day, new Date(year, month + 1, 0).getDate())));
    const existing = state.expenses.some((expense) => expense.recurringExpenseId === item.id && expense.date === dateKey);
    if (existing) return;

    state.expenses.unshift({
      id: `expense-recurring-${item.id}-${monthKey}`,
      date: dateKey,
      title: item.title,
      category: item.category,
      amount: Number(item.amount) || 0,
      recurringExpenseId: item.id,
      isRecurring: true
    });
    changed = true;
  });

  return changed;
}

function getPendingGoalsForDate(state, dateKey) {
  return state.goals.filter((goal) => !isGoalDoneOnDate(state, goal.id, dateKey));
}

function getRecurringExpensesForDay(state, date = new Date()) {
  const day = date.getDate();
  return state.recurringExpenses.filter((item) => Number(item.day) === day);
}

function getExpenseSummaryForMonth(state, monthKey) {
  const expenses = state.expenses.filter((expense) => expense.date.startsWith(monthKey));
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = expenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amount;
    return accumulator;
  }, {});
  return { expenses, spent, byCategory };
}

function changeMonth(state, delta) {
  let { year, month } = state.calendarView;
  month += delta;
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  if (month > 11) {
    month = 0;
    year += 1;
  }
  state.calendarView = { year, month };
}

import { DB_NAME, DB_VERSION, LEGACY_KEY, RECOVERY_SNAPSHOT_KEY, SCHEMA_VERSION, STATE_KEY, STORE_NAME } from "./constants.js";

const NATIVE_STORAGE_MODE_KEY = "zy-diary-native-storage-mode";
const NATIVE_STORAGE_PRIVATE = "private";
const NATIVE_STORAGE_DOCUMENTS = "documents";
const NATIVE_FOLDER = "ZYDiary";
const NATIVE_STATE_FILE = `${NATIVE_FOLDER}/zy-diary-state.json`;
const NATIVE_SNAPSHOT_FILE = `${NATIVE_FOLDER}/zy-diary-recovery-snapshot.json`;

let db = null;

function getDesktopBridge() {
  return typeof window !== "undefined" && window.zyDesktop ? window.zyDesktop : null;
}

function getCapacitorBridge() {
  if (typeof window === "undefined" || !window.Capacitor) return null;
  const isNative = typeof window.Capacitor.isNativePlatform === "function"
    ? window.Capacitor.isNativePlatform()
    : false;
  return isNative ? window.Capacitor : null;
}

function getFilesystemPlugin() {
  return getCapacitorBridge()?.Plugins?.Filesystem || null;
}

function getNativePlatform() {
  return getCapacitorBridge()?.getPlatform?.() || "";
}

function getNativeStorageMode() {
  try {
    return localStorage.getItem(NATIVE_STORAGE_MODE_KEY) || NATIVE_STORAGE_PRIVATE;
  } catch {
    return NATIVE_STORAGE_PRIVATE;
  }
}

function setNativeStorageMode(mode) {
  try {
    localStorage.setItem(NATIVE_STORAGE_MODE_KEY, mode);
  } catch {}
}

function getNativeDirectory(mode = getNativeStorageMode()) {
  return mode === NATIVE_STORAGE_DOCUMENTS ? "DOCUMENTS" : "DATA";
}

function getNativeDirectoryLabel(mode = getNativeStorageMode()) {
  if (mode === NATIVE_STORAGE_DOCUMENTS) {
    return "设备文档目录 / Documents / ZYDiary";
  }
  return "应用私有目录 / Android App Storage / ZYDiary";
}

async function requestNativePublicStoragePermission() {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return false;

  try {
    const status = await filesystem.requestPermissions();
    return status?.publicStorage === "granted";
  } catch {
    return false;
  }
}

async function ensureNativeDirectory(mode = getNativeStorageMode()) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return;

  try {
    await filesystem.mkdir({
      path: NATIVE_FOLDER,
      directory: getNativeDirectory(mode),
      recursive: true
    });
  } catch {}
}

async function readNativeJson(path) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return null;

  const primaryMode = getNativeStorageMode();
  const fallbackMode = primaryMode === NATIVE_STORAGE_PRIVATE ? NATIVE_STORAGE_DOCUMENTS : NATIVE_STORAGE_PRIVATE;

  for (const mode of [primaryMode, fallbackMode]) {
    try {
      const result = await filesystem.readFile({
        path,
        directory: getNativeDirectory(mode),
        encoding: "utf8"
      });
      const text = typeof result?.data === "string" ? result.data : "";
      if (text) {
        if (mode !== primaryMode) {
          setNativeStorageMode(mode);
        }
        return JSON.parse(text);
      }
    } catch {}
  }

  return null;
}

async function writeNativeJson(path, data, mode = getNativeStorageMode()) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) return;

  await ensureNativeDirectory(mode);
  await filesystem.writeFile({
    path,
    directory: getNativeDirectory(mode),
    data: JSON.stringify(data, null, 2),
    encoding: "utf8",
    recursive: true
  });
}

async function getNativeFileInfo(path, mode = getNativeStorageMode()) {
  const filesystem = getFilesystemPlugin();
  if (!filesystem) {
    return { uri: "", size: 0 };
  }

  try {
    const stat = await filesystem.stat({
      path,
      directory: getNativeDirectory(mode)
    });
    return {
      uri: stat?.uri || "",
      size: stat?.size || 0
    };
  } catch {
    return { uri: "", size: 0 };
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(key) {
  return new Promise((resolve) => {
    if (!db) {
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
      return;
    }

    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => resolve(null);
  });
}

function dbSet(key, value) {
  return new Promise((resolve) => {
    if (!db) {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(value));
      resolve();
      return;
    }

    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ key, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

function writeLocalRecoverySnapshot(state) {
  try {
    const snapshot = {
      savedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      state: clone(state)
    };
    localStorage.setItem(RECOVERY_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {}
}

async function writeNativeRecoverySnapshot(state, mode = getNativeStorageMode()) {
  const snapshot = {
    savedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    state: clone(state)
  };
  await writeNativeJson(NATIVE_SNAPSHOT_FILE, snapshot, mode);
}

async function initStorage() {
  if (getDesktopBridge() || getFilesystemPlugin()) return;
  db = await openDb();
}

async function loadPersistedState() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.loadState();
  }

  if (getFilesystemPlugin()) {
    return readNativeJson(NATIVE_STATE_FILE);
  }

  return dbGet(STATE_KEY);
}

async function savePersistedState(state) {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.saveState(clone(state));
  }

  if (getFilesystemPlugin()) {
    const mode = getNativeStorageMode();
    writeLocalRecoverySnapshot(state);
    await writeNativeJson(NATIVE_STATE_FILE, clone(state), mode);
    await writeNativeRecoverySnapshot(state, mode);
    return true;
  }

  writeLocalRecoverySnapshot(state);
  return dbSet(STATE_KEY, state);
}

async function resetPersistedState(defaultState) {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.resetState(clone(defaultState));
  }

  if (getFilesystemPlugin()) {
    return savePersistedState(defaultState);
  }

  writeLocalRecoverySnapshot(defaultState);
  return dbSet(STATE_KEY, defaultState);
}

function createExportPayload(state) {
  const payload = clone(state);
  const exportedFrom = getDesktopBridge()
    ? "electron-desktop"
    : getFilesystemPlugin()
      ? `${getNativePlatform()}-native`
      : "local-browser";

  payload.meta = {
    ...(payload.meta || {}),
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exportManifest: {
      app: "ZY Diary",
      schemaVersion: SCHEMA_VERSION,
      exportedFrom
    }
  };
  return payload;
}

async function parseImportedFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("备份文件内容无效");
  }
  if (!parsed.meta || typeof parsed.meta !== "object") {
    throw new Error("备份文件缺少元数据");
  }
  return parsed;
}

async function getRecoverySnapshotInfo() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.getRecoverySnapshotInfo();
  }

  if (getFilesystemPlugin()) {
    const snapshot = await readNativeJson(NATIVE_SNAPSHOT_FILE);
    const info = await getNativeFileInfo(NATIVE_SNAPSHOT_FILE);
    if (!snapshot) return null;
    return {
      savedAt: snapshot.savedAt || "",
      schemaVersion: snapshot.schemaVersion || 0,
      stateSize: info.size || 0
    };
  }

  try {
    const raw = localStorage.getItem(RECOVERY_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      savedAt: parsed.savedAt || "",
      schemaVersion: parsed.schemaVersion || 0,
      stateSize: raw.length
    };
  } catch {
    return null;
  }
}

async function getStorageDirectoryInfo() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.getStorageInfo();
  }

  if (getFilesystemPlugin()) {
    const mode = getNativeStorageMode();
    const stateInfo = await getNativeFileInfo(NATIVE_STATE_FILE, mode);
    const snapshotInfo = await getNativeFileInfo(NATIVE_SNAPSHOT_FILE, mode);
    return {
      mode: mode === NATIVE_STORAGE_DOCUMENTS ? "native-documents" : "native-private",
      directory: getNativeDirectoryLabel(mode),
      stateFile: stateInfo.uri || NATIVE_STATE_FILE,
      snapshotFile: snapshotInfo.uri || NATIVE_SNAPSHOT_FILE
    };
  }

  return {
    mode: "browser",
    directory: "浏览器本地存储（IndexedDB / localStorage）",
    stateFile: "",
    snapshotFile: ""
  };
}

async function chooseStorageDirectory(state) {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.chooseStorageDirectory(clone(state));
  }

  if (!getFilesystemPlugin()) return null;

  const currentMode = getNativeStorageMode();
  const wantsDocuments = window.confirm("确定切换到设备文档目录吗？\n\n选择“确定”会把数据迁移到手机文档目录中，便于备份与调试；选择“取消”则使用应用私有目录。");
  const nextMode = wantsDocuments ? NATIVE_STORAGE_DOCUMENTS : NATIVE_STORAGE_PRIVATE;

  if (nextMode === NATIVE_STORAGE_DOCUMENTS) {
    const granted = await requestNativePublicStoragePermission();
    if (!granted) {
      throw new Error("未获得设备文档访问权限");
    }
  }

  setNativeStorageMode(nextMode);
  await savePersistedState(state);

  return {
    ...(await getStorageDirectoryInfo()),
    changedFrom: currentMode,
    changedTo: nextMode
  };
}

async function openStorageDirectory() {
  const desktop = getDesktopBridge();
  if (desktop) {
    return desktop.openStorageDirectory();
  }

  return false;
}

import { $ } from "./utils.js";

function createDust() {
  const canvas = $("#dustCanvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const particles = [];
  const pointer = { x: null, y: null, radius: 120 };

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function seedParticles() {
    particles.length = 0;
    const count = Math.round((window.innerWidth * window.innerHeight) / 14000);
    for (let index = 0; index < count; index += 1) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.8 + 0.4,
        alpha: Math.random() * 0.35 + 0.08,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18
      });
    }
  }

  function update() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -10) particle.x = canvas.width + 10;
      if (particle.x > canvas.width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = canvas.height + 10;
      if (particle.y > canvas.height + 10) particle.y = -10;

      if (pointer.x !== null && pointer.y !== null) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < pointer.radius) {
          const force = (pointer.radius - distance) / pointer.radius;
          const angle = Math.atan2(dy, dx);
          particle.x += Math.cos(angle) * force * 4.2;
          particle.y += Math.sin(angle) * force * 4.2;
        }
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fillStyle = `rgba(18, 18, 18, ${particle.alpha})`;
      context.fill();
    });
    window.requestAnimationFrame(update);
  }

  window.addEventListener("resize", () => {
    resize();
    seedParticles();
  });
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  window.addEventListener("pointerleave", () => {
    pointer.x = null;
    pointer.y = null;
  });

  resize();
  seedParticles();
  update();
}

import { addDays, diffDays, formatDateKey, parseDateKey, startOfDay } from "./utils.js";

function startOfWeek(date) {
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(date, delta);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function inRange(dateKey, startKey, endKey) {
  return dateKey >= startKey && dateKey <= endKey;
}

function computeRangeGoalStats(state, startKey, endKey) {
  const perGoal = state.goals.map((goal) => {
    const completed = state.goalLogs
      .filter((log) => log.goalId === goal.id && log.status === "done" && inRange(log.date, startKey, endKey))
      .map((log) => log.date);
    return {
      id: goal.id,
      name: goal.name,
      type: goal.type,
      completedCount: completed.length,
      completedDates: completed
    };
  });

  const totalCheckins = perGoal.reduce((sum, goal) => sum + goal.completedCount, 0);
  const bestGoal = [...perGoal].sort((left, right) => right.completedCount - left.completedCount)[0] || null;

  return {
    perGoal,
    totalCheckins,
    bestGoal,
    activeGoals: perGoal.filter((goal) => goal.completedCount > 0).length
  };
}

function computeRangeExpenseStats(state, startKey, endKey) {
  const expenses = state.expenses.filter((expense) => inRange(expense.date, startKey, endKey));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = expenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amount;
    return accumulator;
  }, {});
  const topCategoryEntry = Object.entries(byCategory).sort((left, right) => right[1] - left[1])[0] || null;

  return {
    expenses,
    total,
    count: expenses.length,
    byCategory,
    topCategory: topCategoryEntry ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] } : null
  };
}

function computeRangeAuraStats(state, startKey, endKey) {
  const events = Object.values(state.auraEvents).filter((event) => inRange(event.date, startKey, endKey));
  const total = events.reduce((sum, event) => sum + event.amount, 0);
  const sources = events.reduce((accumulator, event) => {
    accumulator[event.label] = (accumulator[event.label] || 0) + event.amount;
    return accumulator;
  }, {});
  const topSourceEntry = Object.entries(sources).sort((left, right) => right[1] - left[1])[0] || null;

  return {
    events,
    total,
    count: events.length,
    topSource: topSourceEntry ? { name: topSourceEntry[0], amount: topSourceEntry[1] } : null
  };
}

function computeRangeReviewStats(state, startKey, endKey) {
  const entries = (state.reviewEntries || []).filter((entry) => inRange(entry.date, startKey, endKey));
  const latestEntry = entries[0] || null;
  return {
    count: entries.length,
    latestSummary: latestEntry ? latestEntry.summary : "",
    latestEntry
  };
}

function buildNarrative(periodName, goals, expenses, aura, reviews) {
  const parts = [];

  if (goals.totalCheckins > 0) {
    parts.push(`${periodName}一共完成了 ${goals.totalCheckins} 次目标打卡`);
  } else {
    parts.push(`${periodName}还没有产生目标打卡记录`);
  }

  if (goals.bestGoal && goals.bestGoal.completedCount > 0) {
    parts.push(`最稳定的是「${goals.bestGoal.name}」`);
  }

  if (expenses.total > 0 && expenses.topCategory) {
    parts.push(`支出最高的类别是${expenses.topCategory.name}`);
  } else {
    parts.push("消费压力相对轻");
  }

  if (aura.total > 0) {
    parts.push(`灵气增长了 ${aura.total} 点`);
  }

  if (reviews.count > 0) {
    parts.push(`并且完成了 ${reviews.count} 次正式复盘`);
  }

  return `${parts.join("，")}。`;
}

function buildRangeReport(state, start, end, periodName) {
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);
  const days = diffDays(start, end) + 1;
  const goals = computeRangeGoalStats(state, startKey, endKey);
  const expenses = computeRangeExpenseStats(state, startKey, endKey);
  const aura = computeRangeAuraStats(state, startKey, endKey);
  const reviews = computeRangeReviewStats(state, startKey, endKey);

  return {
    periodName,
    start,
    end,
    startKey,
    endKey,
    days,
    goals,
    expenses,
    aura,
    reviews,
    narrative: buildNarrative(periodName, goals, expenses, aura, reviews)
  };
}

function getWeeklyReport(state, now = new Date()) {
  const today = startOfDay(now);
  return buildRangeReport(state, startOfWeek(today), endOfWeek(today), "本周");
}

function getMonthlyReport(state, now = new Date()) {
  const today = startOfDay(now);
  return buildRangeReport(state, startOfMonth(today), endOfMonth(today), "本月");
}

function formatRangeLabel(start, end) {
  const startDate = parseDateKey(formatDateKey(start));
  const endDate = parseDateKey(formatDateKey(end));
  return `${startDate.getMonth() + 1}.${String(startDate.getDate()).padStart(2, "0")} - ${endDate.getMonth() + 1}.${String(endDate.getDate()).padStart(2, "0")}`;
}

function initHomePage(context) {
  if (document.body.dataset.page !== "home") return;

  context.syncOverviewStats();
  context.renderAuraTimeline(document.getElementById("auraTimeline"));
  context.renderAbilityList(document.getElementById("unlockedAbilities"));
  context.updateRealmWidgets();
  initOnboardingCard(context);
  renderHomeTimePanel(context);
  window.setInterval(() => renderHomeTimePanel(context), 1000);
}

function initOnboardingCard(context) {
  const panel = $("#onboardingPanel");
  const grid = $("#onboardingGrid");
  const progress = $("#onboardingProgressText");
  const dismissButton = $("#dismissOnboardingButton");
  if (!panel || !grid || !progress || !dismissButton) return;

  const render = () => {
    const steps = getOnboardingSteps(context);
    const completedCount = steps.filter((step) => step.done).length;
    const allDone = completedCount === steps.length;
    const dismissed = Boolean(context.state.settings?.onboarding?.dismissed);

    if (allDone || dismissed) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    progress.textContent = `${completedCount} / ${steps.length} \u5df2\u5b8c\u6210`;
    grid.innerHTML = "";

    steps.forEach((step) => {
      const article = document.createElement("article");
      article.className = `onboarding-step${step.done ? " done" : ""}`;
      article.innerHTML = `
        <div class="onboarding-step-copy">
          <span class="tag">${step.done ? "\u5df2\u5b8c\u6210" : "\u5f85\u5b8c\u6210"}</span>
          <strong>${step.title}</strong>
          <p>${step.description}</p>
        </div>
        <a class="button ${step.done ? "ghost" : "primary"} small" href="${step.href}">${step.actionLabel}</a>
      `;
      grid.appendChild(article);
    });
  };

  dismissButton.addEventListener("click", async () => {
    context.state.settings.onboarding = {
      ...(context.state.settings.onboarding || {}),
      dismissed: true
    };
    await context.saveState();
    panel.hidden = true;
  });

  render();
}

function getOnboardingSteps(context) {
  const userName = context.getUserName().trim();
  const hasCustomName = userName && userName !== "\u4fee\u884c\u8005";
  const hasGoal = context.state.goals.length > 0;
  const hasReviewEntry = context.state.reviewEntries.length > 0;
  const hasOpenedHelp = Boolean(context.state.meta?.helpOpenedAt);

  return [
    {
      title: "\u8bbe\u7f6e\u4f60\u7684\u7528\u6237\u540d",
      description: "\u8ba9\u5f00\u5c4f\u95ee\u5019\u3001\u9996\u9875\u6587\u6848\u548c\u63d0\u9192\u90fd\u771f\u6b63\u5e26\u4e0a\u4f60\u7684\u540d\u5b57\u3002",
      done: hasCustomName,
      href: "./profile.html",
      actionLabel: hasCustomName ? "\u518d\u6b21\u67e5\u770b" : "\u53bb\u8bbe\u7f6e"
    },
    {
      title: "\u521b\u5efa\u7b2c\u4e00\u4e2a\u76ee\u6807",
      description: "\u5148\u4ece 2 \u5230 3 \u4e2a\u6700\u91cd\u8981\u7684\u65e5\u5e38\u76ee\u6807\u5f00\u59cb\uff0c\u4f1a\u66f4\u5bb9\u6613\u7a33\u5b9a\u575a\u6301\u3002",
      done: hasGoal,
      href: "./goals.html",
      actionLabel: hasGoal ? "\u67e5\u770b\u76ee\u6807" : "\u53bb\u521b\u5efa"
    },
    {
      title: "\u5199\u4e0b\u7b2c\u4e00\u6761\u8bb0\u5f55",
      description: "\u53ea\u8981\u5199\u6e05\u4eca\u5929\u63a8\u8fdb\u4e86\u4ec0\u4e48\u3001\u5361\u4f4f\u4e86\u4ec0\u4e48\u3001\u660e\u5929\u5148\u505a\u4ec0\u4e48\uff0c\u5c31\u5df2\u7ecf\u8db3\u591f\u3002",
      done: hasReviewEntry,
      href: "./daily.html",
      actionLabel: hasReviewEntry ? "\u7ee7\u7eed\u8bb0\u5f55" : "\u53bb\u8bb0\u5f55"
    },
    {
      title: "\u770b\u4e00\u773c\u5e2e\u52a9\u4e2d\u5fc3",
      description: "\u5e2e\u52a9\u9875\u4f1a\u96c6\u4e2d\u4ecb\u7ecd\u529f\u80fd\u7ed3\u6784\u3001\u63a8\u8350\u6d41\u7a0b\u3001\u63d0\u9192\u548c\u5907\u4efd\u7684\u7528\u6cd5\u3002",
      done: hasOpenedHelp,
      href: "./help.html",
      actionLabel: hasOpenedHelp ? "\u518d\u6b21\u67e5\u770b" : "\u53bb\u770b\u770b"
    }
  ];
}

function renderHomeTimePanel(context) {
  const now = new Date();
  const dateText = $("#currentDateText");
  const timeText = $("#currentTimeText");
  const dayLeft = $("#dayHoursLeft");
  const monthLeft = $("#monthHoursLeft");
  const yearLeft = $("#yearHoursLeft");
  const visit = $("#visitStreak");

  if (dateText) dateText.textContent = formatDisplayDate(now);
  if (timeText) timeText.textContent = formatClock(now);
  if (dayLeft) dayLeft.textContent = formatCountdown(timeUntilEndOfDay(now));
  if (monthLeft) monthLeft.textContent = formatCountdown(timeUntilEndOfMonth(now));
  if (yearLeft) yearLeft.textContent = formatCountdown(timeUntilEndOfYear(now));
  if (visit) visit.textContent = `${context.state.visit.streak} \u5929`;
}

function initDailyPage(context) {
  if (document.body.dataset.page !== "daily") return;

  const win = $("#dailyWin");
  const block = $("#dailyBlock");
  const next = $("#dailyNext");
  const mood = $("#dailyMood");
  const energy = $("#dailyEnergy");
  const focus = $("#dailyFocus");
  const summary = $("#dailySummary");
  const statusTrace = $("#dailyStatusTrace");
  const save = $("#saveDailyButton");
  const saved = $("#dailySavedMessage");
  const realm = $("#dailyRealm");
  const aura = $("#dailyAura");
  const todayEntry = getReviewEntryByDate(context.state, context.todayKey);

  win.value = todayEntry?.win || "";
  block.value = todayEntry?.block || "";
  next.value = todayEntry?.next || "";
  mood.value = todayEntry?.mood || "平静";
  energy.value = todayEntry?.energy || "稳定";
  focus.value = todayEntry?.focus || "专注";
  summary.textContent = todayEntry?.summary || "还没有今日记录。写下今天最重要的推进和下一步，会更容易形成连续感。";
  saved.textContent = todayEntry?.savedAt ? `最近保存于 ${todayEntry.savedAt}` : "今天还没有保存记录";
  renderStatusTrace(statusTrace, mood.value, energy.value, focus.value);
  if (realm) realm.textContent = context.getAuraSummary().currentRealm.name;
  if (aura) aura.textContent = `灵气 ${context.getAuraSummary().total}`;

  [mood, energy, focus].forEach((select) => {
    select.addEventListener("change", () => {
      renderStatusTrace(statusTrace, mood.value, energy.value, focus.value);
    });
  });

  save.addEventListener("click", async () => {
    const reviewWin = win.value.trim();
    const reviewBlock = block.value.trim();
    const reviewNext = next.value.trim();
    const reviewSummary = buildReviewSummary(reviewWin, reviewBlock, reviewNext);
    const savedAt = formatTimestamp(new Date());

    upsertReviewEntry(context.state, {
      date: context.todayKey,
      win: reviewWin,
      block: reviewBlock,
      next: reviewNext,
      mood: mood.value,
      energy: energy.value,
      focus: focus.value,
      summary: reviewSummary,
      savedAt
    });

    summary.textContent = reviewSummary;
    saved.textContent = `最近保存于 ${savedAt}`;
    renderStatusTrace(statusTrace, mood.value, energy.value, focus.value);

    if (context.state.review.rewardedDate !== context.todayKey) {
      context.state.review.rewardedDate = context.todayKey;
      setAuraEvent(context.state, `review-${context.todayKey}`, 1, "完成今日复盘", context.todayKey);
    }

    await context.saveState();
    if (realm) realm.textContent = context.getAuraSummary().currentRealm.name;
    if (aura) aura.textContent = `灵气 ${context.getAuraSummary().total}`;
    context.updateRealmWidgets();
  });

  context.updateRealmWidgets();
}

function renderStatusTrace(target, mood, energy, focus) {
  if (!target) return;
  target.innerHTML = `
    <span class="tag">情绪：${mood}</span>
    <span class="tag">精力：${energy}</span>
    <span class="tag">专注：${focus}</span>
  `;
}

function initReviewPage(context) {
  if (document.body.dataset.page !== "review") return;

  const title = $("#reviewHistoryTitle");
  const summary = $("#reviewHistorySummary");
  const saved = $("#reviewHistorySavedAt");
  const statusTrace = $("#reviewHistoryStatus");
  const historyList = $("#reviewHistoryList");
  const historyCount = $("#reviewHistoryCount");
  const calendarGrid = $("#reviewCalendarGrid");
  const calendarTitle = $("#reviewCalendarTitle");
  const prevButton = $("#reviewPrevMonthButton");
  const nextButton = $("#reviewNextMonthButton");

  let selectedDate = context.state.reviewEntries[0]?.date || context.todayKey;

  function renderSelected() {
    const entry = getReviewEntryByDate(context.state, selectedDate);
    if (!entry) {
      title.textContent = "当前没有可展示的记录";
      summary.textContent = "这个日期还没有保存过复盘记录。请从每日记录页先写下一条正式记录。";
      saved.textContent = "未保存";
      if (statusTrace) statusTrace.innerHTML = "";
      return;
    }
    title.textContent = formatDisplayDate(parseDateKey(entry.date));
    summary.textContent = entry.summary;
    saved.textContent = `保存时间：${entry.savedAt}`;
    if (statusTrace) {
      statusTrace.innerHTML = `
        <span class="tag">情绪：${entry.mood || "平静"}</span>
        <span class="tag">精力：${entry.energy || "稳定"}</span>
        <span class="tag">专注：${entry.focus || "专注"}</span>
      `;
    }
  }

  function renderHistory() {
    const entries = getRecentReviewEntries(context.state, 6);
    historyCount.textContent = `${context.state.reviewEntries.length} 条记录`;
    historyList.innerHTML = "";

    if (!entries.length) {
      historyList.innerHTML = `<article class="mini-event"><strong>还没有历史记录</strong><span>先去每日记录页写下第一篇正式记录。</span></article>`;
      return;
    }

    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `history-item${entry.date === selectedDate ? " active" : ""}`;
      button.innerHTML = `<strong>${entry.date}</strong><span>${entry.summary}</span>`;
      button.addEventListener("click", () => {
        selectedDate = entry.date;
        renderHistory();
        renderSelected();
        syncCalendarViewToSelected();
        renderCalendar();
      });
      historyList.appendChild(button);
    });
  }

  function syncCalendarViewToSelected() {
    const date = parseDateKey(selectedDate);
    context.state.reviewCalendarView = { year: date.getFullYear(), month: date.getMonth() };
  }

  function renderCalendar() {
    const { year, month } = context.state.reviewCalendarView;
    calendarTitle.textContent = `${year} 年 ${month + 1} 月`;
    calendarGrid.innerHTML = "";

    ["一", "二", "三", "四", "五", "六", "日"].forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "calendar-weekday";
      cell.textContent = day;
      calendarGrid.appendChild(cell);
    });

    const first = new Date(year, month, 1);
    const leading = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();

    for (let index = 0; index < leading; index += 1) {
      const empty = document.createElement("div");
      empty.className = "calendar-day calendar-empty";
      calendarGrid.appendChild(empty);
    }

    for (let day = 1; day <= total; day += 1) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry = getReviewEntryByDate(context.state, dateKey);
      if (!entry) {
        const disabled = document.createElement("div");
        disabled.className = "review-calendar-day muted";
        disabled.textContent = day;
        calendarGrid.appendChild(disabled);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = `review-calendar-day${dateKey === selectedDate ? " active" : ""}`;
      button.textContent = day;
      button.addEventListener("click", () => {
        selectedDate = dateKey;
        renderSelected();
        renderHistory();
        renderCalendar();
      });
      calendarGrid.appendChild(button);
    }
  }

  prevButton.addEventListener("click", async () => {
    let { year, month } = context.state.reviewCalendarView;
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    context.state.reviewCalendarView = { year, month };
    await context.saveState();
    renderCalendar();
  });

  nextButton.addEventListener("click", async () => {
    let { year, month } = context.state.reviewCalendarView;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    context.state.reviewCalendarView = { year, month };
    await context.saveState();
    renderCalendar();
  });

  syncCalendarViewToSelected();
  renderSelected();
  renderHistory();
  renderCalendar();
  context.updateRealmWidgets();
}

import { WEEKDAYS } from "../core/constants.js";

function parsePoolInput(value, fallback) {
  const items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function formatPoolInput(pool) {
  return (pool || []).join("\n");
}

function initGoalsPage(context) {
  if (document.body.dataset.page !== "goals") return;

  const tabs = $("#goalTabs");
  const summary = $("#goalSummary");
  const grid = $("#calendarGrid");
  const title = $("#calendarTitle");
  const spin = $("#spinButton");
  const wheelText = $("#wheelStateText");
  const wheelResult = $("#wheelResult");
  const wheelPoolList = $("#wheelPoolList");
  const toggle = $("#toggleTodayButton");
  const action = $("#goalActionMessage");
  const add = $("#addGoalButton");
  const cancelEdit = $("#cancelGoalEditButton");
  const editGoalButton = $("#editGoalButton");
  const deleteGoalButton = $("#deleteGoalButton");
  const manageMessage = $("#goalManageMessage");
  const editorHint = $("#goalEditorHint");
  const message = $("#goalFormMessage");
  const prev = $("#prevMonthButton");
  const next = $("#nextMonthButton");
  const streak = $("#goalStreakCount");
  const repair = $("#repairStatus");
  const progress = $("#repairProgress");
  const nameInput = $("#goalNameInput");
  const typeInput = $("#goalTypeInput");
  const rewardInput = $("#goalRewardInput");
  const penaltyInput = $("#goalPenaltyInput");

  let editingGoalId = "";

  const rewardDefaults = ["今晚可以自由安排 30 分钟", "给自己一杯喜欢的饮品", "听一张喜欢的专辑"];
  const penaltyDefaults = ["补做 10 分钟复盘", "今晚少刷 20 分钟手机", "做 20 个开合跳"];

  const getActiveGoal = () => context.state.goals.find((goal) => goal.id === context.state.activeGoalId) || context.state.goals[0];

  const resetEditor = () => {
    editingGoalId = "";
    editorHint.textContent = "当前正在创建新目标。";
    add.textContent = "新增目标";
    nameInput.value = "";
    typeInput.value = "学习类";
    rewardInput.value = "";
    penaltyInput.value = "";
  };

  const populateEditor = (goal) => {
    editingGoalId = goal.id;
    editorHint.textContent = `正在编辑「${goal.name}」`;
    add.textContent = "保存修改";
    nameInput.value = goal.name;
    typeInput.value = goal.type;
    rewardInput.value = formatPoolInput(goal.rewardPool);
    penaltyInput.value = formatPoolInput(goal.penaltyPool);
  };

  const renderWheelPool = () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      wheelPoolList.innerHTML = `<article class="mini-event"><strong>暂无转盘内容</strong><span>先创建目标并填写奖励或惩罚选项。</span></article>`;
      return;
    }
    const doneToday = isGoalDoneOnDate(context.state, activeGoal.id, context.todayKey);
    const pool = doneToday ? activeGoal.rewardPool : activeGoal.penaltyPool;
    wheelPoolList.innerHTML = "";
    pool.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = "mini-event";
      article.innerHTML = `<strong>${doneToday ? "奖励" : "惩罚"} ${index + 1}</strong><span>${item}</span>`;
      wheelPoolList.appendChild(article);
    });
  };

  const renderEmptyGoals = () => {
    tabs.innerHTML = `<article class="mini-event goal-empty-state"><strong>还没有目标</strong><span>先创建一条目标，日历和转盘会立刻接上。</span></article>`;
    summary.textContent = "当前还没有目标，先从左侧创建第一条修行路径。";
    title.textContent = "目标日历";
    grid.innerHTML = `<article class="calendar-empty-state"><strong>暂无日历内容</strong><span>创建目标后，这里会显示按月打卡视图。</span></article>`;
    streak.textContent = "0 天";
    repair.textContent = "未触发";
    progress.textContent = "0 / 3";
    wheelText.textContent = "先创建一个目标，转盘才会根据完成状态判定奖励或惩罚。";
    toggle.textContent = "今日完成打卡";
    wheelResult.textContent = "等待转动";
    manageMessage.textContent = "先创建一个目标，再进行编辑或删除。";
    renderWheelPool();
  };

  const renderTabs = () => {
    tabs.innerHTML = "";
    if (!context.state.goals.length) {
      renderEmptyGoals();
      return;
    }

    context.state.goals.forEach((goal) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `goal-tab${goal.id === context.state.activeGoalId ? " active" : ""}`;
      button.textContent = goal.name;
      button.addEventListener("click", async () => {
        context.state.activeGoalId = goal.id;
        await context.saveState();
        renderTabs();
        renderCalendar();
        renderStreak();
        renderWheelPool();
        wheelResult.textContent = "等待转动";
        manageMessage.textContent = `当前选中「${goal.name}」，可以继续打卡或编辑。`;
      });
      tabs.appendChild(button);
    });
  };

  const renderCalendar = () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      renderEmptyGoals();
      return;
    }

    grid.innerHTML = "";
    WEEKDAYS.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "calendar-weekday";
      cell.textContent = day;
      grid.appendChild(cell);
    });

    const { year, month } = context.state.calendarView;
    title.textContent = `${year} 年 ${month + 1} 月`;
    const first = new Date(year, month, 1);
    const leading = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();

    for (let index = 0; index < leading; index += 1) {
      const empty = document.createElement("div");
      empty.className = "calendar-day calendar-empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= total; day += 1) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const done = isGoalDoneOnDate(context.state, activeGoal.id, dateKey);
      const cell = document.createElement("div");
      cell.className = `calendar-day${done ? " done" : ""}${dateKey === context.todayKey ? " today" : ""}`;
      cell.innerHTML = `<span class="day-number">${day}</span><span class="emoji">${done ? "😊" : "😭"}</span>`;
      grid.appendChild(cell);
    }

    const completedDates = getGoalCompletedDates(context.state, activeGoal.id);
    const monthCount = completedDates.filter((dateKey) => {
      const date = parseDateKey(dateKey);
      return date.getFullYear() === year && date.getMonth() === month;
    }).length;

    summary.textContent = `${activeGoal.type} · 本月已完成 ${monthCount} / ${total} 天`;

    const doneToday = isGoalDoneOnDate(context.state, activeGoal.id, context.todayKey);
    wheelText.textContent = doneToday
      ? `今天已经完成「${activeGoal.name}」，可以抽取奖励。`
      : `今天还未完成「${activeGoal.name}」，需要接受一次惩罚。`;
    toggle.textContent = doneToday ? "取消今日打卡" : "今日完成打卡";
  };

  const renderStreak = () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      renderEmptyGoals();
      return;
    }

    const meta = activeGoal.streakMeta;
    streak.textContent = `${meta.current} 天`;
    repair.textContent = meta.repair.active ? "补签中" : "未触发";
    progress.textContent = `${meta.repair.progress} / 3`;
  };

  toggle.addEventListener("click", async () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      action.textContent = "先创建一个目标，再开始打卡。";
      return;
    }

    const doneToday = toggleGoalLog(context.state, activeGoal.id, context.todayKey, context.todayKey);
    const updatedGoal = context.state.goals.find((goal) => goal.id === activeGoal.id);

    if (doneToday) {
      setAuraEvent(context.state, `goal-${activeGoal.id}-${context.todayKey}`, 1, `完成目标：${activeGoal.name}`, context.todayKey);
      action.textContent = updatedGoal.streakMeta.repair.active
        ? `已记录今天完成了「${activeGoal.name}」，补签进度 ${updatedGoal.streakMeta.repair.progress}/3。`
        : `已记录今天完成了「${activeGoal.name}」。`;
    } else {
      removeAuraEvent(context.state, `goal-${activeGoal.id}-${context.todayKey}`);
      action.textContent = `已将「${activeGoal.name}」恢复为未完成状态。`;
    }

    syncAllGoalsBonus(context.state, context.todayKey);
    await context.saveState();
    renderTabs();
    renderCalendar();
    renderStreak();
    renderWheelPool();
    wheelResult.textContent = "等待转动";
    context.updateRealmWidgets();
  });

  spin.addEventListener("click", () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      wheelResult.textContent = "先创建目标再转动。";
      return;
    }

    const doneToday = isGoalDoneOnDate(context.state, activeGoal.id, context.todayKey);
    const pool = doneToday ? activeGoal.rewardPool : activeGoal.penaltyPool;
    const label = doneToday ? "今日奖励" : "今日惩罚";
    wheelResult.textContent = `${label}：${pool[Math.floor(Math.random() * pool.length)]}`;
  });

  add.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const type = typeInput.value;
    const rewardPool = parsePoolInput(rewardInput.value, rewardDefaults);
    const penaltyPool = parsePoolInput(penaltyInput.value, penaltyDefaults);

    if (!name) {
      message.textContent = "请先输入目标名称";
      return;
    }

    const duplicated = context.state.goals.some((goal) => goal.name === name && goal.id !== editingGoalId);
    if (duplicated) {
      message.textContent = "已经有同名目标了，换一个更具体的名字吧。";
      return;
    }

    if (editingGoalId) {
      updateGoal(context.state, editingGoalId, { name, type, rewardPool, penaltyPool });
      await context.saveState();
      message.textContent = `已更新目标「${name}」`;
      manageMessage.textContent = `目标「${name}」已更新。`;
      resetEditor();
    } else {
      const goal = normalizeGoal({
        id: `goal-${Date.now()}`,
        name,
        type,
        completedDates: [],
        rewardPool,
        penaltyPool
      });

      context.state.goals.push(goal);
      context.state.activeGoalId = goal.id;
      await context.saveState();
      message.textContent = `已新增目标「${goal.name}」`;
      manageMessage.textContent = `目标「${goal.name}」已经加入修行清单。`;
      resetEditor();
    }

    renderTabs();
    renderCalendar();
    renderStreak();
    renderWheelPool();
    context.updateRealmWidgets();
  });

  cancelEdit.addEventListener("click", () => {
    resetEditor();
    message.textContent = "已退出编辑模式。";
  });

  editGoalButton.addEventListener("click", () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      manageMessage.textContent = "先创建一个目标，再开始编辑。";
      return;
    }
    populateEditor(activeGoal);
    manageMessage.textContent = `正在编辑「${activeGoal.name}」。`;
  });

  deleteGoalButton.addEventListener("click", async () => {
    const activeGoal = getActiveGoal();
    if (!activeGoal) {
      manageMessage.textContent = "当前没有可删除的目标。";
      return;
    }
    if (!window.confirm(`确认删除目标「${activeGoal.name}」吗？相关打卡记录也会一起删除。`)) return;
    deleteGoal(context.state, activeGoal.id);
    syncAllGoalsBonus(context.state, context.todayKey);
    await context.saveState();
    manageMessage.textContent = `目标「${activeGoal.name}」已删除。`;
    message.textContent = "你可以继续创建新的目标。";
    resetEditor();
    renderTabs();
    renderCalendar();
    renderStreak();
    renderWheelPool();
    context.updateRealmWidgets();
  });

  prev.addEventListener("click", async () => {
    changeMonth(context.state, -1);
    await context.saveState();
    renderCalendar();
  });

  next.addEventListener("click", async () => {
    changeMonth(context.state, 1);
    await context.saveState();
    renderCalendar();
  });

  resetEditor();
  renderTabs();
  renderCalendar();
  renderStreak();
  renderWheelPool();
  context.updateRealmWidgets();
}

function initLedgerPage(context) {
  if (document.body.dataset.page !== "ledger") return;

  const list = $("#expenseList");
  const recurringList = $("#recurringExpenseList");
  const bar = $("#barChart");
  const pie = $("#pieChart");
  const pieLegend = $("#pieLegend");
  const legend = $("#ledgerLegend");
  const add = $("#addExpenseButton");
  const message = $("#expenseFormMessage");
  const recurringMessage = $("#recurringFormMessage");
  const saveBudgetButton = $("#saveBudgetButton");
  const budgetMessage = $("#budgetFormMessage");
  const budgetCategoryGrid = $("#budgetCategoryGrid");
  const budgetSpentText = $("#budgetSpentText");
  const budgetRemainingText = $("#budgetRemainingText");
  const budgetUsageText = $("#budgetUsageText");
  const filterCategory = $("#expenseFilterCategory");
  const searchInput = $("#expenseSearchInput");
  const monthTitle = $("#ledgerMonthTitle");
  const prevMonthButton = $("#ledgerPrevMonthButton");
  const nextMonthButton = $("#ledgerNextMonthButton");
  const saveRecurringButton = $("#saveRecurringButton");
  const syncRecurringButton = $("#syncRecurringButton");
  let currentMonth = new Date();
  let editingExpenseId = "";
  let editingRecurringId = "";

  bindLedgerToggle();

  function getCurrentMonthKey() {
    return getMonthKey(currentMonth);
  }

  async function ensureRecurringCoverage() {
    const changed = syncRecurringExpensesForMonth(context.state, currentMonth);
    if (changed) {
      await context.saveState();
    }
  }

  async function renderAll() {
    await ensureRecurringCoverage();
    const monthKey = getCurrentMonthKey();
    const monthLabel = formatMonthTitle(currentMonth);
    monthTitle.textContent = monthLabel;
    fillBudgetForm(context, monthKey);
    renderExpenses(context, list, monthKey, filterCategory.value, searchInput.value, beginEdit, removeExpense);
    renderRecurringExpenses(context, recurringList, beginRecurringEdit, removeRecurring);
    renderExpenseCharts(context, bar, pie, pieLegend, legend, monthKey, monthLabel);
    renderBudgetSummary(context, monthKey, budgetCategoryGrid, budgetSpentText, budgetRemainingText, budgetUsageText);
  }

  add.addEventListener("click", async () => {
    const title = $("#expenseTitleInput").value.trim();
    const category = $("#expenseCategoryInput").value;
    const amount = Number($("#expenseAmountInput").value);

    if (!title) {
      message.textContent = "请先填写消费名称";
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      message.textContent = "请输入大于 0 的金额";
      return;
    }

    if (editingExpenseId) {
      context.state.expenses = context.state.expenses.map((expense) =>
        expense.id === editingExpenseId ? { ...expense, title, category, amount } : expense
      );
      message.textContent = `已更新消费「${title}」`;
      add.textContent = "新增消费";
      editingExpenseId = "";
    } else {
      context.state.expenses.unshift({
        id: `expense-${Date.now()}`,
        date: context.todayKey,
        title,
        category,
        amount
      });
      message.textContent = `已新增消费「${title}」`;
    }

    await context.saveState();
    $("#expenseTitleInput").value = "";
    $("#expenseAmountInput").value = "";
    renderAll();
    context.updateRealmWidgets();
  });

  saveRecurringButton.addEventListener("click", async () => {
    const title = $("#recurringTitleInput").value.trim();
    const category = $("#recurringCategoryInput").value;
    const amount = Number($("#recurringAmountInput").value);
    const day = Number($("#recurringDayInput").value);

    if (!title) {
      recurringMessage.textContent = "请先填写固定消费名称。";
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      recurringMessage.textContent = "请输入有效的固定消费金额。";
      return;
    }

    upsertRecurringExpense(context.state, {
      id: editingRecurringId || "",
      title,
      category,
      amount,
      day
    });
    editingRecurringId = "";
    saveRecurringButton.textContent = "保存固定消费";
    recurringMessage.textContent = "固定消费已保存，并会参与当月同步。";
    $("#recurringTitleInput").value = "";
    $("#recurringAmountInput").value = "";
    $("#recurringCategoryInput").value = category;
    $("#recurringCategoryInput").dispatchEvent(new Event("change"));
    await context.saveState();
    await renderAll();
  });

  syncRecurringButton.addEventListener("click", async () => {
    const changed = syncRecurringExpensesForMonth(context.state, currentMonth);
    if (changed) {
      await context.saveState();
      recurringMessage.textContent = `已同步 ${getCurrentMonthKey()} 的固定消费到账本。`;
    } else {
      recurringMessage.textContent = "当前月份的固定消费已经是最新状态。";
    }
    await renderAll();
  });

  saveBudgetButton.addEventListener("click", async () => {
    const total = Number($("#budgetTotalInput").value);
    const categories = {
      饮食: Number($("#budgetFoodInput").value),
      学习: Number($("#budgetStudyInput").value),
      出行: Number($("#budgetTravelInput").value),
      娱乐: Number($("#budgetFunInput").value),
      生活: Number($("#budgetLifeInput").value)
    };

    if (!Number.isFinite(total) || total < 0) {
      budgetMessage.textContent = "请输入有效的月总预算。";
      return;
    }

    const monthKey = getCurrentMonthKey();
    setBudgetForMonth(context.state, monthKey, { total, categories });
    await context.saveState();
    budgetMessage.textContent = `已保存 ${monthKey} 的预算配置。`;
    renderAll();
  });

  filterCategory.addEventListener("change", renderAll);
  searchInput.addEventListener("input", renderAll);

  prevMonthButton.addEventListener("click", async () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    await renderAll();
  });

  nextMonthButton.addEventListener("click", async () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    await renderAll();
  });

  renderAll();
  context.updateRealmWidgets();

  function beginEdit(expense) {
    editingExpenseId = expense.id;
    $("#expenseTitleInput").value = expense.title;
    $("#expenseCategoryInput").value = expense.category;
    $("#expenseCategoryInput").dispatchEvent(new Event("change"));
    $("#expenseAmountInput").value = expense.amount;
    add.textContent = "保存修改";
    message.textContent = `正在编辑消费「${expense.title}」`;
  }

  function beginRecurringEdit(item) {
    editingRecurringId = item.id;
    $("#recurringTitleInput").value = item.title;
    $("#recurringCategoryInput").value = item.category;
    $("#recurringCategoryInput").dispatchEvent(new Event("change"));
    $("#recurringAmountInput").value = item.amount;
    $("#recurringDayInput").value = `${item.day}`;
    $("#recurringDayInput").dispatchEvent(new Event("change"));
    saveRecurringButton.textContent = "保存修改";
    recurringMessage.textContent = `正在编辑固定消费「${item.title}」`;
  }

  async function removeExpense(expense) {
    if (!window.confirm(`确认删除消费「${expense.title}」吗？`)) return;
    context.state.expenses = context.state.expenses.filter((item) => item.id !== expense.id);
    if (editingExpenseId === expense.id) {
      editingExpenseId = "";
      add.textContent = "新增消费";
      $("#expenseTitleInput").value = "";
      $("#expenseAmountInput").value = "";
    }
    await context.saveState();
    message.textContent = `已删除消费「${expense.title}」`;
    renderAll();
    context.updateRealmWidgets();
  }

  async function removeRecurring(item) {
    if (!window.confirm(`确认删除固定消费「${item.title}」吗？`)) return;
    deleteRecurringExpense(context.state, item.id);
    if (editingRecurringId === item.id) {
      editingRecurringId = "";
      saveRecurringButton.textContent = "保存固定消费";
      $("#recurringTitleInput").value = "";
      $("#recurringAmountInput").value = "";
    }
    await context.saveState();
    recurringMessage.textContent = `已删除固定消费「${item.title}」`;
    await renderAll();
  }
}

function fillBudgetForm(context, monthKey) {
  const budget = getBudgetForMonth(context.state, monthKey);
  $("#budgetTotalInput").value = budget.total || "";
  $("#budgetFoodInput").value = budget.categories?.饮食 || "";
  $("#budgetStudyInput").value = budget.categories?.学习 || "";
  $("#budgetTravelInput").value = budget.categories?.出行 || "";
  $("#budgetFunInput").value = budget.categories?.娱乐 || "";
  $("#budgetLifeInput").value = budget.categories?.生活 || "";
}

function renderBudgetSummary(context, monthKey, grid, spentNode, remainingNode, usageNode) {
  const budget = getBudgetForMonth(context.state, monthKey);
  const expenseSummary = getExpenseSummaryForMonth(context.state, monthKey);
  const spent = expenseSummary.spent;
  const remaining = (budget.total || 0) - spent;
  const usage = budget.total > 0 ? Math.min(999, Math.round((spent / budget.total) * 100)) : 0;

  spentNode.textContent = `¥${spent.toFixed(0)}`;
  remainingNode.textContent = budget.total > 0 ? `¥${Math.max(remaining, 0).toFixed(0)}` : "未设预算";
  usageNode.textContent = budget.total > 0 ? `${usage}%` : "--";

  grid.innerHTML = "";
  ["饮食", "学习", "出行", "娱乐", "生活"].forEach((category) => {
    const limit = Number(budget.categories?.[category]) || 0;
    const used = Number(expenseSummary.byCategory?.[category]) || 0;
    const rest = limit - used;
    const article = document.createElement("article");
    article.className = `mini-event budget-card${limit > 0 && used > limit ? " over" : ""}`;
    article.innerHTML = `<strong>${category}</strong><span>${limit > 0 ? `预算 ¥${limit.toFixed(0)} · 已用 ¥${used.toFixed(0)} · ${rest >= 0 ? `剩余 ¥${rest.toFixed(0)}` : `超出 ¥${Math.abs(rest).toFixed(0)}`}` : `本月已用 ¥${used.toFixed(0)} · 还没有设分类预算`}</span>`;
    grid.appendChild(article);
  });
}

function renderExpenses(context, target, monthKey, categoryFilter, searchKeyword, onEdit, onDelete) {
  target.innerHTML = "";
  const keyword = (searchKeyword || "").trim().toLowerCase();
  const expenses = context.state.expenses.filter((expense) => {
    const monthPass = expense.date.startsWith(monthKey);
    const categoryPass = categoryFilter === "all" || expense.category === categoryFilter;
    const keywordPass = !keyword || expense.title.toLowerCase().includes(keyword);
    return monthPass && categoryPass && keywordPass;
  });

  if (!expenses.length) {
    target.innerHTML = `<article class="mini-event"><strong>这个月份还没有记录</strong><span>你可以先新增一笔消费，或者同步固定消费。</span></article>`;
    return;
  }

  expenses.forEach((expense) => {
    const item = document.createElement("article");
    item.className = "expense-item";
    item.innerHTML = `
      <div class="expense-icon ${colorClass(expense.category)}">${expense.date.slice(8)}</div>
      <div class="expense-meta">
        <strong>${expense.title}${expense.isRecurring ? " · 固定" : ""}</strong>
        <span>${expense.category} · ${expense.date}</span>
      </div>
      <strong class="expense-amount">¥${expense.amount.toFixed(2)}</strong>
      <div class="expense-actions">
        <button class="mini-button" type="button">编辑</button>
        <button class="mini-button danger" type="button">删除</button>
      </div>
    `;
    const [editButton, deleteButton] = item.querySelectorAll("button");
    editButton.addEventListener("click", () => onEdit(expense));
    deleteButton.addEventListener("click", () => onDelete(expense));
    target.appendChild(item);
  });
}

function renderRecurringExpenses(context, target, onEdit, onDelete) {
  target.innerHTML = "";
  if (!context.state.recurringExpenses.length) {
    target.innerHTML = `<article class="mini-event"><strong>还没有固定消费项目</strong><span>例如房租、会员、交通卡，都适合放在这里长期管理。</span></article>`;
    return;
  }

  context.state.recurringExpenses
    .slice()
    .sort((left, right) => left.day - right.day)
    .forEach((item) => {
      const article = document.createElement("article");
      article.className = "expense-item recurring-item";
      article.innerHTML = `
        <div class="expense-icon ${colorClass(item.category)}">${String(item.day).padStart(2, "0")}</div>
        <div class="expense-meta">
          <strong>${item.title}</strong>
          <span>${item.category} · 每月 ${item.day} 日自动记账</span>
        </div>
        <strong class="expense-amount">¥${Number(item.amount).toFixed(2)}</strong>
        <div class="expense-actions">
          <button class="mini-button" type="button">编辑</button>
          <button class="mini-button danger" type="button">删除</button>
        </div>
      `;
      const [editButton, deleteButton] = article.querySelectorAll("button");
      editButton.addEventListener("click", () => onEdit(item));
      deleteButton.addEventListener("click", () => onDelete(item));
      target.appendChild(article);
    });
}

function renderExpenseCharts(context, bar, pie, pieLegend, legend, monthKey, monthLabel) {
  const monthlyExpenses = context.state.expenses
    .filter((expense) => expense.date.startsWith(monthKey))
    .sort((left, right) => left.date.localeCompare(right.date));
  const latest = monthlyExpenses.slice(-6);
  const max = Math.max(...latest.map((item) => item.amount), 1);
  bar.innerHTML = "";

  if (!latest.length) {
    bar.innerHTML = `<article class="mini-event"><strong>本月暂无消费走势</strong><span>新增几笔消费后，这里会开始显示金额变化。</span></article>`;
  }

  latest.forEach((item) => {
    const node = document.createElement("div");
    node.className = "bar";
    node.innerHTML = `<i style="height:${Math.max(20, (item.amount / max) * 180)}px;"></i><strong>¥${item.amount.toFixed(0)}</strong><span>${item.date.slice(5)}</span>`;
    bar.appendChild(node);
  });

  pie.dataset.label = monthLabel;

  const palette = { 饮食: "#d97a57", 学习: "#5d8f76", 出行: "#6f87c7", 娱乐: "#c6a458", 生活: "#8f7580" };
  const totals = monthlyExpenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amount;
    return accumulator;
  }, {});
  const entries = Object.entries(totals);
  const sum = entries.reduce((total, [, value]) => total + value, 0) || 1;

  let cursor = 0;
  pie.style.background = entries.length
    ? `conic-gradient(${entries.map(([name, value]) => {
      const start = cursor;
      cursor += (value / sum) * 100;
      return `${palette[name] || "#aaa"} ${start}% ${cursor}%`;
    }).join(", ")})`
    : "rgba(255, 255, 255, 0.62)";

  pieLegend.innerHTML = "";
  legend.innerHTML = "";
  if (!entries.length) {
    const empty = `<span class="legend-item"><i class="legend-dot" style="background:#bdb5aa"></i>本月还没有消费分类数据</span>`;
    pieLegend.insertAdjacentHTML("beforeend", empty);
    legend.insertAdjacentHTML("beforeend", empty);
    return;
  }

  entries.forEach(([name, value]) => {
    const html = `<span class="legend-item"><i class="legend-dot" style="background:${palette[name] || "#aaa"}"></i>${name} ¥${value.toFixed(0)}</span>`;
    pieLegend.insertAdjacentHTML("beforeend", html);
    legend.insertAdjacentHTML("beforeend", html);
  });
}

function bindLedgerToggle() {
  const toggles = document.querySelectorAll(".toggle");
  const list = $("#listView");
  const chart = $("#chartView");

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggles.forEach((item) => item.classList.remove("active"));
      toggle.classList.add("active");
      const showChart = toggle.dataset.view === "chart";
      list.classList.toggle("active", !showChart);
      chart.classList.toggle("active", showChart);
    });
  });
}

function colorClass(category) {
  return ({ 饮食: "food", 学习: "study", 出行: "travel", 娱乐: "fun", 生活: "life" })[category] || "life";
}

function formatMonthTitle(date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

export function initReportsPage(context) {
  if (document.body.dataset.page !== "reports") return;

  const weeklyButton = document.querySelector("#weeklyReportButton");
  const monthlyButton = document.querySelector("#monthlyReportButton");
  let mode = "weekly";

  const render = () => {
    const report = mode === "weekly" ? context.getWeeklyReport() : context.getMonthlyReport();
    weeklyButton.classList.toggle("active", mode === "weekly");
    monthlyButton.classList.toggle("active", mode === "monthly");

    document.querySelector("#reportPeriodTag").textContent = mode === "weekly" ? "周报" : "月报";
    document.querySelector("#reportTitle").textContent = mode === "weekly" ? "这一周的修行总结" : "这个月的修行总结";
    document.querySelector("#reportRange").textContent = formatRangeLabel(report.start, report.end);
    document.querySelector("#reportNarrative").textContent = report.narrative;

    document.querySelector("#reportGoalCheckins").textContent = `${report.goals.totalCheckins}`;
    document.querySelector("#reportActiveGoals").textContent = `${report.goals.activeGoals}`;
    document.querySelector("#reportExpenseTotal").textContent = `¥${report.expenses.total.toFixed(0)}`;
    document.querySelector("#reportAuraTotal").textContent = `${report.aura.total}`;

    document.querySelector("#reportGoalInsight").textContent = report.goals.bestGoal && report.goals.bestGoal.completedCount > 0
      ? `表现最稳的是「${report.goals.bestGoal.name}」，本周期完成 ${report.goals.bestGoal.completedCount} 次。`
      : "这一周期还没有形成明显的目标完成节奏。";

    document.querySelector("#reportExpenseInsight").textContent = report.expenses.topCategory
      ? `支出最高类别是 ${report.expenses.topCategory.name}，累计 ¥${report.expenses.topCategory.amount.toFixed(0)}。`
      : "这一周期还没有记录消费，资源流向保持空白。";

    document.querySelector("#reportAuraInsight").textContent = report.aura.topSource
      ? `灵气主要来自「${report.aura.topSource.name}」，累计 ${report.aura.topSource.amount} 点。`
      : "这一周期还没有新的灵气来源。";

    document.querySelector("#reportReviewInsight").textContent = report.reviews.count > 0
      ? `${report.reviews.count} 条复盘记录。${report.reviews.latestSummary || "这一周期完成了正式复盘。"}`
      : "这一周期还没有保存正式复盘。";

    renderGoalBoard(report);
    renderExpenseBoard(report);
    renderAuraBoard(report);
  };

  weeklyButton.addEventListener("click", () => {
    mode = "weekly";
    render();
  });

  monthlyButton.addEventListener("click", () => {
    mode = "monthly";
    render();
  });

  render();
}

function renderGoalBoard(report) {
  const target = document.querySelector("#reportGoalBoard");
  target.innerHTML = "";

  if (!report.goals.perGoal.length) {
    target.innerHTML = `<article class="mini-event"><strong>暂无目标</strong><span>先去目标页创建你的第一条修行路径。</span></article>`;
    return;
  }

  report.goals.perGoal.forEach((goal) => {
    const article = document.createElement("article");
    article.className = "mini-event";
    article.innerHTML = `<strong>${goal.name}</strong><span>${goal.type} · 完成 ${goal.completedCount} 次</span>`;
    target.appendChild(article);
  });
}

function renderExpenseBoard(report) {
  const target = document.querySelector("#reportExpenseBoard");
  target.innerHTML = "";
  const entries = Object.entries(report.expenses.byCategory);

  if (!entries.length) {
    target.innerHTML = `<article class="mini-event"><strong>暂无消费</strong><span>这一周期没有记录任何支出。</span></article>`;
    return;
  }

  entries.sort((left, right) => right[1] - left[1]).forEach(([name, value]) => {
    const article = document.createElement("article");
    article.className = "mini-event";
    article.innerHTML = `<strong>${name}</strong><span>累计 ¥${value.toFixed(0)}</span>`;
    target.appendChild(article);
  });
}

function renderAuraBoard(report) {
  const target = document.querySelector("#reportAuraBoard");
  target.innerHTML = "";

  if (!report.aura.events.length) {
    target.innerHTML = `<article class="mini-event"><strong>暂无灵气事件</strong><span>先去完成一次复盘或目标打卡。</span></article>`;
    return;
  }

  report.aura.events.forEach((event) => {
    const article = document.createElement("article");
    article.className = "mini-event";
    article.innerHTML = `<strong>${event.label}</strong><span>${event.date} · +${event.amount} 灵气</span>`;
    target.appendChild(article);
  });
}

import { getDefaultState } from "../core/constants.js";

function initProfilePage(context) {
  if (document.body.dataset.page !== "profile") return;

  context.updateRealmWidgets();
  context.renderAbilityList($("#profileAbilities"));
  context.renderRealmList($("#realmList"));
  context.renderAuraTimeline($("#profileTimeline"));

  const exportButton = $("#exportDataButton");
  const importInput = $("#importDataInput");
  const resetDemoButton = $("#resetDemoButton");
  const clearDataButton = $("#clearDataButton");
  const openDirectoryButton = $("#openStorageDirectoryButton");
  const changeDirectoryButton = $("#changeStorageDirectoryButton");
  const saveUsernameButton = $("#saveUsernameButton");
  const usernameInput = $("#usernameInput");
  const themeSelect = $("#themeSelect");
  const saveThemeButton = $("#saveThemeButton");
  const reminderEnabledInput = $("#reminderEnabledInput");
  const dailyReminderEnabledInput = $("#dailyReminderEnabledInput");
  const dailyReminderTimeInput = $("#dailyReminderTimeInput");
  const goalsReminderEnabledInput = $("#goalsReminderEnabledInput");
  const goalsReminderTimeInput = $("#goalsReminderTimeInput");
  const recurringReminderEnabledInput = $("#recurringReminderEnabledInput");
  const recurringReminderTimeInput = $("#recurringReminderTimeInput");
  const saveReminderSettingsButton = $("#saveReminderSettingsButton");
  const requestNotificationPermissionButton = $("#requestNotificationPermissionButton");
  const reminderSettingsMessage = $("#reminderSettingsMessage");
  const message = $("#dataToolsMessage");
  const recoverySavedAt = $("#recoverySavedAt");
  const recoverySchemaVersion = $("#recoverySchemaVersion");
  const recoveryStateSize = $("#recoveryStateSize");
  const storageDirectoryPath = $("#storageDirectoryPath");
  const storageDirectoryMode = $("#storageDirectoryMode");
  const storageStateFile = $("#storageStateFile");
  const storageSnapshotFile = $("#storageSnapshotFile");

  usernameInput.value = context.getUserName();
  if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
  renderReminderSettings();

  async function renderRecoverySnapshot() {
    const info = await getRecoverySnapshotInfo();
    if (!info) {
      recoverySavedAt.textContent = "暂无快照";
      recoverySchemaVersion.textContent = "--";
      recoveryStateSize.textContent = "--";
      return;
    }

    recoverySavedAt.textContent = info.savedAt ? info.savedAt.replace("T", " ").slice(0, 16) : "暂无时间";
    recoverySchemaVersion.textContent = `v${info.schemaVersion || "--"}`;
    recoveryStateSize.textContent = `${Math.max(1, Math.round((info.stateSize || 0) / 1024))} KB`;
  }

  async function renderStorageDirectory() {
    const info = await getStorageDirectoryInfo();
    storageDirectoryPath.textContent = info?.directory || "当前无法读取存储目录";
    storageStateFile.textContent = info?.stateFile || "--";
    storageSnapshotFile.textContent = info?.snapshotFile || "--";
    if (info?.mode === "desktop-file") {
      storageDirectoryMode.textContent = "桌面文件存储";
      openDirectoryButton.disabled = false;
      changeDirectoryButton.disabled = false;
      changeDirectoryButton.textContent = "更改目录";
      return;
    }

    if (info?.mode === "native-documents") {
      storageDirectoryMode.textContent = "安卓文档目录存储";
      openDirectoryButton.disabled = true;
      changeDirectoryButton.disabled = false;
      changeDirectoryButton.textContent = "切换存储位置";
      return;
    }

    if (info?.mode === "native-private") {
      storageDirectoryMode.textContent = "安卓应用私有存储";
      openDirectoryButton.disabled = true;
      changeDirectoryButton.disabled = false;
      changeDirectoryButton.textContent = "切换存储位置";
      return;
    }

    storageDirectoryMode.textContent = "浏览器本地存储";
    openDirectoryButton.disabled = true;
    changeDirectoryButton.disabled = true;
  }

  saveUsernameButton.addEventListener("click", async () => {
    const nextName = usernameInput.value.trim();
    if (!nextName) {
      message.textContent = "请先输入用户名。";
      return;
    }
    context.state.settings.username = nextName;
    await context.saveState();
    context.updateIdentityWidgets();
    message.textContent = `用户名已更新为「${nextName}」。下次启动时开屏问候也会同步变化。`;
  });

  saveThemeButton?.addEventListener("click", async () => {
    context.state.settings.theme = themeSelect.value || "dawn";
    await context.saveState();
    context.applyTheme();
    message.textContent = `主题已切换为「${themeSelect.value === "ink" ? "夜墨青金" : "晨雾米金"}」。`;
  });

  saveReminderSettingsButton?.addEventListener("click", async () => {
    context.state.settings.reminders = {
      enabled: Boolean(reminderEnabledInput?.checked),
      daily: Boolean(dailyReminderEnabledInput?.checked),
      dailyTime: dailyReminderTimeInput?.value || "21:30",
      goals: Boolean(goalsReminderEnabledInput?.checked),
      goalsTime: goalsReminderTimeInput?.value || "20:30",
      recurring: Boolean(recurringReminderEnabledInput?.checked),
      recurringTime: recurringReminderTimeInput?.value || "10:00"
    };
    await context.saveState();
    reminderSettingsMessage.textContent = "提醒设置已保存，新的时间会从下一次检查开始生效。";
  });

  requestNotificationPermissionButton?.addEventListener("click", async () => {
    const result = await context.requestNativeNotificationPermission();
    reminderSettingsMessage.textContent = result.granted
      ? "原生通知能力已开启，后续提醒会尝试同步到系统通知。"
      : "原生通知权限未开启，应用仍会继续使用页面内轻提醒。";
    if ("Notification" in window && requestNotificationPermissionButton) {
      requestNotificationPermissionButton.textContent = result.granted
        ? "系统通知已开启"
        : "启用系统通知权限";
    }
  });

  exportButton.addEventListener("click", () => {
    const payload = createExportPayload(context.state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zy-diary-backup-${context.todayKey}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.textContent = "备份文件已导出。";
  });

  importInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const imported = await parseImportedFile(file);
      const merged = mergeState({
        ...imported,
        meta: {
          ...(imported.meta || {}),
          lastImportedAt: new Date().toISOString()
        }
      });
      context.replaceState(merged);
      usernameInput.value = context.getUserName();
      if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
      renderReminderSettings();
      await context.saveState();
      message.textContent = "备份导入成功，已刷新当前状态。";
      context.applyTheme();
      context.updateRealmWidgets();
      await renderRecoverySnapshot();
      await renderStorageDirectory();
    } catch {
      message.textContent = "导入失败：请确认文件是有效的 ZY Diary JSON 备份。";
    } finally {
      importInput.value = "";
    }
  });

  resetDemoButton.addEventListener("click", async () => {
    if (!window.confirm("这会用演示数据覆盖当前本地数据，是否继续？")) return;
    const nextState = mergeState(getDefaultState());
    context.replaceState(nextState);
    usernameInput.value = context.getUserName();
    await resetPersistedState(nextState);
    if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
    renderReminderSettings();
    message.textContent = "已经恢复为空白初始状态。";
    context.applyTheme();
    context.updateRealmWidgets();
    await renderRecoverySnapshot();
    await renderStorageDirectory();
  });

  clearDataButton.addEventListener("click", async () => {
    if (!window.confirm("这会清空当前本地数据，是否继续？")) return;
    const emptyState = mergeState(getDefaultState(new Date()));
    emptyState.goals = [];
    emptyState.goalLogs = [];
    emptyState.expenses = [];
    emptyState.reviewEntries = [];
    emptyState.annotations = [];
    emptyState.auraEvents = {};
    emptyState.recurringExpenses = [];
    emptyState.review = { win: "", block: "", next: "", summary: "", savedAt: "", rewardedDate: "" };
    context.replaceState(emptyState);
    usernameInput.value = context.getUserName();
    if (themeSelect) themeSelect.value = context.state.settings.theme || "dawn";
    renderReminderSettings();
    await resetPersistedState(emptyState);
    message.textContent = "本地数据已清空。";
    context.applyTheme();
    context.updateRealmWidgets();
    await renderRecoverySnapshot();
    await renderStorageDirectory();
  });

  openDirectoryButton.addEventListener("click", async () => {
    const opened = await openStorageDirectory();
    message.textContent = opened ? "已尝试打开数据目录。" : "当前平台暂不支持直接打开目录，但你仍然可以查看或切换存储位置。";
  });

  changeDirectoryButton.addEventListener("click", async () => {
    try {
      const nextInfo = await chooseStorageDirectory(context.state);
      if (!nextInfo) {
        message.textContent = "已取消更改数据目录。";
        return;
      }
      message.textContent = nextInfo.mode === "native-documents"
        ? "已切换到设备文档目录，当前状态也已迁移。"
        : nextInfo.mode === "native-private"
          ? "已切换到应用私有目录，当前状态也已迁移。"
          : "数据目录已更新，当前状态也已迁移到新目录。";
      await renderStorageDirectory();
      await renderRecoverySnapshot();
    } catch (error) {
      message.textContent = error?.message || "切换存储位置失败，请稍后再试。";
    }
  });

  renderRecoverySnapshot();
  renderStorageDirectory();

  function renderReminderSettings() {
    const reminders = context.state.settings.reminders || {};
    if (reminderEnabledInput) reminderEnabledInput.checked = reminders.enabled !== false;
    if (dailyReminderEnabledInput) dailyReminderEnabledInput.checked = reminders.daily !== false;
    if (dailyReminderTimeInput) dailyReminderTimeInput.value = reminders.dailyTime || "21:30";
    if (goalsReminderEnabledInput) goalsReminderEnabledInput.checked = reminders.goals !== false;
    if (goalsReminderTimeInput) goalsReminderTimeInput.value = reminders.goalsTime || "20:30";
    if (recurringReminderEnabledInput) recurringReminderEnabledInput.checked = reminders.recurring !== false;
    if (recurringReminderTimeInput) recurringReminderTimeInput.value = reminders.recurringTime || "10:00";
    if (requestNotificationPermissionButton && "Notification" in window) {
      requestNotificationPermissionButton.textContent = Notification.permission === "granted"
        ? "系统通知已开启"
        : "启用系统通知权限";
    }
  }
}

import { REALMS, getDefaultState } from "./core/constants.js";

const today = startOfDay(new Date());
const todayKey = formatDateKey(today);

let state = null;

init();

async function init() {
  createDust();
  await initStorage();
  const persisted = await loadPersistedState();
  state = mergeState(persisted || getDefaultState(), today);
  syncVisitStreak(state, todayKey);
  syncAllGoalsBonus(state, todayKey);
  syncRecurringExpensesForMonth(state, today);
  await saveState();

  const context = createContext();
  await syncPageMeta(context);
  initShell(context);
  initHomePage(context);
  initDailyPage(context);
  initReviewPage(context);
  initGoalsPage(context);
  initLedgerPage(context);
  initReportsPage(context);
  initProfilePage(context);
}

async function syncPageMeta(context) {
  if (document.body.dataset.page !== "help") return;
  if (context.state.meta.helpOpenedAt) return;

  context.state.meta.helpOpenedAt = new Date().toISOString();
  context.state.settings.onboarding = {
    ...(context.state.settings.onboarding || {}),
    dismissed: false
  };
  await context.saveState();
}

function createContext() {
  return {
    get state() {
      return state;
    },
    todayKey,
    saveState,
    replaceState(nextState) {
      state = mergeState(nextState, today);
    },
    syncOverviewStats,
    renderAuraTimeline,
    renderAbilityList,
    renderRealmList,
    updateRealmWidgets,
    updateIdentityWidgets,
    applyTheme,
    requestNativeNotificationPermission,
    getUserName,
    getAuraSummary() {
      return getAuraSummary(state);
    },
    getWeeklyReport() {
      return getWeeklyReport(state, today);
    },
    getMonthlyReport() {
      return getMonthlyReport(state, today);
    }
  };
}

function getUserName() {
  return state?.settings?.username?.trim() || "修行者";
}

async function saveState() {
  state.meta.updatedAt = new Date().toISOString();
  await savePersistedState(state);
  await syncNativeNotifications();
}

function initShell(context) {
  applyTheme();
  bindTopbarBehavior();
  updateIdentityWidgets();
  runLaunchSplash(context);
  initReminderSystem(context);
  syncNativeNotifications();
}

function applyTheme() {
  const theme = state?.settings?.theme || "dawn";
  document.body.dataset.theme = theme;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", theme === "ink" ? "#11161b" : "#efe9df");
  }
  const themeDescription = $("#themeDescription");
  if (themeDescription) {
    themeDescription.textContent = theme === "ink" ? "夜墨青金" : "晨雾米金";
  }
}

function initReminderSystem(context) {
  ensureReminderCenter();
  runReminderCheck(context);
  window.setInterval(() => runReminderCheck(context), 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      runReminderCheck(context);
    }
  });
}

function ensureReminderCenter() {
  if (document.getElementById("reminderCenter")) return;
  const center = document.createElement("div");
  center.id = "reminderCenter";
  center.className = "reminder-center";
  document.body.appendChild(center);
}

async function runReminderCheck(context) {
  const reminders = context.state.settings.reminders || {};
  if (reminders.enabled === false) return;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayLogKey = context.todayKey;
  context.state.meta.reminderLog = context.state.meta.reminderLog || {};

  const dueChecks = [
    {
      enabled: reminders.daily !== false,
      time: reminders.dailyTime || "21:30",
      key: `daily-${todayLogKey}`,
      buildMessage: () => {
        const hasEntry = context.state.reviewEntries.some((entry) => entry.date === context.todayKey);
        return hasEntry ? null : {
          title: "每日记录提醒",
          body: `${context.getUserName()}，今天也要好好生活。别忘了留下一条今日记录。`
        };
      }
    },
    {
      enabled: reminders.goals !== false,
      time: reminders.goalsTime || "20:30",
      key: `goals-${todayLogKey}`,
      buildMessage: () => {
        const pendingGoals = getPendingGoalsForDate(context.state, context.todayKey);
        if (!pendingGoals.length) return null;
        const names = pendingGoals.slice(0, 2).map((goal) => goal.name).join("、");
        return {
          title: "目标未完成提醒",
          body: pendingGoals.length > 2
            ? `今天还有 ${pendingGoals.length} 个目标待完成，例如：${names}。`
            : `今天还有待完成目标：${names}。`
        };
      }
    },
    {
      enabled: reminders.recurring !== false,
      time: reminders.recurringTime || "10:00",
      key: `recurring-${todayLogKey}`,
      buildMessage: () => {
        const recurringItems = getRecurringExpensesForDay(context.state, now);
        if (!recurringItems.length) return null;
        const names = recurringItems.slice(0, 2).map((item) => item.title).join("、");
        return {
          title: "固定消费提醒",
          body: recurringItems.length > 2
            ? `今天有 ${recurringItems.length} 项固定消费，例如：${names}。`
            : `今天的固定消费项目：${names}。`
        };
      }
    }
  ];

  let changed = false;

  for (const item of dueChecks) {
    if (!item.enabled || item.time !== currentTime || context.state.meta.reminderLog[item.key]) continue;
    const payload = item.buildMessage();
    if (!payload) {
      context.state.meta.reminderLog[item.key] = "skipped";
      changed = true;
      continue;
    }

    showReminderBanner(payload.title, payload.body);
    fireSystemNotification(payload.title, payload.body);
    context.state.meta.reminderLog[item.key] = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    await context.saveState();
  }
}

function showReminderBanner(title, body) {
  const center = document.getElementById("reminderCenter");
  if (!center) return;

  const card = document.createElement("article");
  card.className = "reminder-toast";
  card.innerHTML = `
    <div class="reminder-toast-copy">
      <strong>${title}</strong>
      <span>${body}</span>
    </div>
    <button class="reminder-toast-close" type="button" aria-label="关闭提醒">知道了</button>
  `;

  const close = () => {
    card.classList.add("is-leaving");
    window.setTimeout(() => card.remove(), 260);
  };

  card.querySelector("button")?.addEventListener("click", close);
  center.appendChild(card);
  window.setTimeout(() => card.classList.add("is-visible"), 20);
  window.setTimeout(close, 7000);
}

function fireSystemNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, {
      body,
      icon: "./build/icon.png",
      silent: true
    });
    window.setTimeout(() => notification.close(), 6000);
  } catch {}
}

function getDesktopBridge() {
  return typeof window !== "undefined" && window.zyDesktop ? window.zyDesktop : null;
}

function getCapacitorBridge() {
  if (typeof window === "undefined" || !window.Capacitor) return null;
  const isNative = typeof window.Capacitor.isNativePlatform === "function"
    ? window.Capacitor.isNativePlatform()
    : false;
  return isNative ? window.Capacitor : null;
}

function getLocalNotificationsPlugin() {
  return getCapacitorBridge()?.Plugins?.LocalNotifications || null;
}

async function requestNativeNotificationPermission() {
  const localNotifications = getLocalNotificationsPlugin();
  if (localNotifications) {
    try {
      const current = await localNotifications.checkPermissions();
      if (current.display === "granted") return { granted: true, source: "capacitor" };
      const requested = await localNotifications.requestPermissions();
      return { granted: requested.display === "granted", source: "capacitor" };
    } catch {
      return { granted: false, source: "capacitor" };
    }
  }

  const desktop = getDesktopBridge();
  if (desktop) {
    try {
      const supported = await desktop.notificationsSupported();
      return { granted: Boolean(supported), source: "electron" };
    } catch {
      return { granted: false, source: "electron" };
    }
  }

  if ("Notification" in window) {
    const result = await Notification.requestPermission();
    return { granted: result === "granted", source: "web" };
  }

  return { granted: false, source: "unsupported" };
}

function buildNativeNotificationPlan() {
  const reminders = state?.settings?.reminders || {};
  if (reminders.enabled === false) return [];

  const plan = [];
  const baseItems = [
    {
      id: 4101,
      enabled: reminders.daily !== false,
      time: reminders.dailyTime || "21:30",
      title: "每日记录提醒",
      body: `${getUserName()}，今天也要好好生活。别忘了留下一条今日记录。`
    },
    {
      id: 4102,
      enabled: reminders.goals !== false,
      time: reminders.goalsTime || "20:30",
      title: "目标未完成提醒",
      body: "去看看今天的目标面板，也许还差最后一笔打卡。"
    },
    {
      id: 4103,
      enabled: reminders.recurring !== false && (state?.recurringExpenses?.length || 0) > 0,
      time: reminders.recurringTime || "10:00",
      title: "固定消费提醒",
      body: "今天记得确认固定消费项目，让账本保持真实。"
    }
  ];

  baseItems.forEach((item) => {
    if (!item.enabled) return;
    const [hour, minute] = item.time.split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    plan.push({ ...item, hour, minute });
  });

  return plan;
}

async function syncNativeNotifications() {
  const plan = buildNativeNotificationPlan();
  const desktop = getDesktopBridge();
  if (desktop) {
    const notifications = plan.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      at: getNextNotificationDate(item.hour, item.minute).toISOString()
    }));
    try {
      await desktop.syncNotifications(notifications);
    } catch {}
  }

  const localNotifications = getLocalNotificationsPlugin();
  if (!localNotifications) return;

  try {
    const permission = await localNotifications.checkPermissions();
    if (permission.display !== "granted") return;

    await localNotifications.cancel({
      notifications: [
        { id: 4101 },
        { id: 4102 },
        { id: 4103 }
      ]
    });

    if (!plan.length) return;

    try {
      await localNotifications.createChannel({
        id: "zy-diary-reminders",
        name: "ZY Diary 提醒",
        description: "每日记录、目标与固定消费提醒",
        importance: 4,
        visibility: 1
      });
    } catch {}

    await localNotifications.schedule({
      notifications: plan.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        channelId: "zy-diary-reminders",
        smallIcon: "ic_launcher_foreground",
        schedule: {
          on: {
            hour: item.hour,
            minute: item.minute
          },
          allowWhileIdle: true
        }
      }))
    });
  } catch {}
}

function getNextNotificationDate(hour, minute) {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function bindTopbarBehavior() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  let lastScrollY = window.scrollY;
  let hidden = false;
  let ticking = false;

  const update = () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY + 8 && currentScrollY > 88) {
      hidden = true;
    } else if (currentScrollY < lastScrollY - 8 || currentScrollY <= 24) {
      hidden = false;
    }

    document.body.classList.toggle("topbar-hidden", hidden);
    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

function updateIdentityWidgets() {
  const userName = getUserName();
  document.querySelectorAll("[data-username-text]").forEach((node) => {
    node.textContent = userName;
  });
}

function runLaunchSplash(context) {
  if (sessionStorage.getItem("zy-diary-splash-seen") === "1") return;
  sessionStorage.setItem("zy-diary-splash-seen", "1");

  const overlay = document.createElement("div");
  overlay.className = "launch-splash";
  overlay.innerHTML = `
    <div class="launch-splash-panel">
      <img class="launch-splash-logo" src="./build/brand-logo.png" alt="ZY Diary logo">
      <p class="launch-splash-label">ZY Diary</p>
      <h1 class="launch-splash-line"></h1>
    </div>
  `;
  document.body.appendChild(overlay);

  const line = overlay.querySelector(".launch-splash-line");
  const text = `${context.getUserName()}，今天也要好好生活。`;
  let index = 0;

  const timer = window.setInterval(() => {
    index += 1;
    line.textContent = text.slice(0, index);
    if (index >= text.length) {
      window.clearInterval(timer);
      overlay.classList.add("is-complete");
      window.setTimeout(() => {
        overlay.classList.add("is-leaving");
        window.setTimeout(() => overlay.remove(), 720);
      }, 650);
    }
  }, 85);
}

function syncOverviewStats() {
  const goalCount = $("#todayGoalCount");
  const expense = $("#todayExpenseAmount");
  const count = state.goals.filter((goal) => isGoalDoneOnDate(state, goal.id, todayKey)).length;
  const amount = state.expenses.filter((item) => item.date === todayKey).reduce((sum, item) => sum + item.amount, 0);

  if (goalCount) goalCount.textContent = `${count}`;
  if (expense) expense.textContent = `¥${amount.toFixed(0)}`;
}

function renderAuraTimeline(target) {
  if (!target) return;
  const events = Object.values(state.auraEvents).sort((left, right) => right.date.localeCompare(left.date)).slice(0, 6);
  target.innerHTML = "";

  if (!events.length) {
    target.innerHTML = `<article class="mini-event"><strong>尚未积累灵气</strong><span>从今天完成一次复盘或目标打卡开始。</span></article>`;
    return;
  }

  events.forEach((event) => {
    const article = document.createElement("article");
    article.className = "mini-event";
    article.innerHTML = `<strong>${event.label}</strong><span>${event.date} · +${event.amount} 灵气</span>`;
    target.appendChild(article);
  });
}

function renderAbilityList(target) {
  if (!target) return;
  const summary = getAuraSummary(state);
  target.innerHTML = "";
  REALMS.slice(0, summary.realmIndex + 1).forEach((realm) => {
    const item = document.createElement("article");
    item.className = "mini-event";
    item.innerHTML = `<strong>${realm.ability}</strong><span>${realm.name}</span>`;
    target.appendChild(item);
  });
}

function renderRealmList(target) {
  if (!target) return;
  const summary = getAuraSummary(state);
  target.innerHTML = "";
  REALMS.forEach((realm, index) => {
    const item = document.createElement("article");
    item.className = `realm-item${index === summary.realmIndex ? " current" : ""}${index > summary.realmIndex ? " locked" : ""}`;
    item.innerHTML = `<div><strong>${realm.name}</strong><span>${realm.ability}</span></div><span class="tag">需 ${realm.aura} 灵气</span>`;
    target.appendChild(item);
  });
}

function updateRealmWidgets() {
  const summary = getAuraSummary(state);
  const realm = summary.currentRealm.name;
  const profileRealm = $("#profileRealm");
  const profileAura = $("#profileAura");
  const bar = $("#realmProgress");
  const reviewRealm = $("#reviewRealm");
  const reviewAura = $("#reviewAura");
  const homeRealm = $("#currentRealm");
  const dailyRealm = $("#dailyRealm");
  const dailyAura = $("#dailyAura");
  const todayAura = $("#todayAuraGain");
  const core = $("#avatarCore");
  const stage = $("#avatarStage");

  if (profileRealm) profileRealm.textContent = realm;
  if (profileAura) profileAura.textContent = `灵气 ${summary.total} / ${summary.nextRealm.aura}`;
  if (bar) bar.style.width = `${summary.progress}%`;
  if (reviewRealm) reviewRealm.textContent = realm;
  if (reviewAura) reviewAura.textContent = `灵气 ${summary.total}`;
  if (homeRealm) homeRealm.textContent = realm;
  if (dailyRealm) dailyRealm.textContent = realm;
  if (dailyAura) dailyAura.textContent = `灵气 ${summary.total}`;
  if (todayAura) {
    todayAura.textContent = `${Object.values(state.auraEvents).filter((item) => item.date === todayKey).reduce((sum, item) => sum + item.amount, 0)}`;
  }

  if (core && stage) {
    const palettes = [
      ["#ffffff", "#9ac7af", "#2b5441"],
      ["#ffffff", "#aad8cb", "#2f6b67"],
      ["#fff7d6", "#d7c16d", "#7c6631"],
      ["#f4ddff", "#b98de1", "#503172"],
      ["#d9f5ff", "#6db6d1", "#214760"],
      ["#ffe3ef", "#f28ab3", "#6e274d"],
      ["#f6f6ff", "#b1b6ff", "#313c7d"],
      ["#fff3de", "#f0b765", "#7b4d1a"]
    ];
    const palette = palettes[Math.min(summary.realmIndex, palettes.length - 1)];
    core.style.background = `radial-gradient(circle at 30% 30%, ${palette[0]}, ${palette[1]} 30%, ${palette[2]} 78%)`;
    core.style.boxShadow = `0 0 ${40 + summary.realmIndex * 3}px ${palette[1]}`;
    stage.style.boxShadow = `inset 0 0 0 1px rgba(35,76,58,0.16), 0 0 ${20 + summary.realmIndex * 4}px rgba(255,255,255,0.24)`;
  }

  syncOverviewStats();
  updateIdentityWidgets();
  renderAuraTimeline($("#auraTimeline"));
  renderAuraTimeline($("#profileTimeline"));
  renderAbilityList($("#unlockedAbilities"));
  renderAbilityList($("#profileAbilities"));
  renderRealmList($("#realmList"));
}
})();
