import { REALMS, SCHEMA_VERSION, getDefaultState } from "./constants.js";
import { addDays, clone, diffDays, formatDateKey, parseDateKey, shorten, startOfDay } from "./utils.js";

export function normalizeGoal(goal) {
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

export function migrateLegacyState(state, now = new Date()) {
  const next = clone(state);
  const previousSchemaVersion = Number(next.meta?.schemaVersion || 0);
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
  sanitizeLegacyDemoData(next, previousSchemaVersion);

  return next;
}

function sanitizeLegacyDemoData(state, previousSchemaVersion) {
  const hasRecords = Boolean(
    state.goals.length ||
    state.goalLogs.length ||
    state.expenses.length ||
    state.recurringExpenses.length ||
    state.reviewEntries.length ||
    state.annotations.length ||
    Object.keys(state.auraEvents || {}).length
  );
  if (!hasRecords) return;

  const isLegacySchema = previousSchemaVersion > 0 && previousSchemaVersion < 5;
  const isDefaultIdentity = (state.settings?.username || "").trim() === "修行者";
  const hasNoImportTrace = !state.meta?.lastImportedAt;
  const looksLikeFreshDevice = !state.visit?.lastDate || Number(state.visit?.streak || 0) <= 1;
  const alreadyCleaned = Boolean(state.meta?.demoAutoCleanedAt);

  if (!isLegacySchema || !isDefaultIdentity || !hasNoImportTrace || !looksLikeFreshDevice || alreadyCleaned) {
    return;
  }

  state.goals = [];
  state.goalLogs = [];
  state.expenses = [];
  state.recurringExpenses = [];
  state.reviewEntries = [];
  state.annotations = [];
  state.auraEvents = {};
  state.review = { win: "", block: "", next: "", summary: "", savedAt: "", rewardedDate: "" };
  state.activeGoalId = "";
  state.meta.demoAutoCleanedAt = new Date().toISOString();
}

export function mergeState(persisted, now = new Date()) {
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

export function countCurrentStreak(completedDates, todayKey) {
  let cursor = parseDateKey(todayKey);
  let count = 0;
  while (completedDates.includes(formatDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function computeRepair(completedDates, todayKey) {
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

export function computeStreakMeta(completedDates, todayKey = formatDateKey(startOfDay(new Date()))) {
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

export function syncVisitStreak(state, todayKey) {
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

export function setAuraEvent(state, id, amount, label, todayKey) {
  state.auraEvents[id] = { amount, label, date: todayKey };
}

export function removeAuraEvent(state, id) {
  delete state.auraEvents[id];
}

export function syncAllGoalsBonus(state, todayKey) {
  const allDone = state.goals.length > 0 && state.goals.every((goal) => goal.completedDates.includes(todayKey));
  if (allDone) {
    setAuraEvent(state, `all-goals-${todayKey}`, 3, "完成今日全部目标", todayKey);
  } else {
    removeAuraEvent(state, `all-goals-${todayKey}`);
  }
}

export function getAuraSummary(state) {
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

export function buildReviewSummary(win, block, next) {
  const partA = win ? `今天推进最明显的是：${shorten(win)}。` : "今天还没有记录清晰的突破点。";
  const partB = block ? `主要阻碍集中在：${shorten(block)}。` : "今天没有记录明显阻碍，整体节奏相对稳定。";
  const partC = next ? `明天最值得优先处理的是：${shorten(next)}。` : "明天的优先事项还需要再明确一下。";

  let tone = "整体来看，这是适合继续稳步推进的一天。";
  if (win && next && !block) tone = "整体状态偏稳，可以沿着已有节奏继续放大优势。";
  if (block && next) tone = "最关键的不是自责，而是把阻碍拆成明天可执行的一步。";

  return `${partA}${partB}${partC}${tone}`;
}

export function getReviewEntryByDate(state, dateKey) {
  return state.reviewEntries.find((entry) => entry.date === dateKey) || null;
}

export function upsertReviewEntry(state, entry) {
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

export function getRecentReviewEntries(state, limit = 6) {
  return state.reviewEntries.slice(0, limit);
}

export function getGoalCompletedDates(state, goalId) {
  return state.goalLogs
    .filter((log) => log.goalId === goalId && log.status === "done")
    .map((log) => log.date)
    .sort();
}

export function updateGoal(state, goalId, updates) {
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

export function deleteGoal(state, goalId) {
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

export function isGoalDoneOnDate(state, goalId, dateKey) {
  return state.goalLogs.some((log) => log.goalId === goalId && log.date === dateKey && log.status === "done");
}

export function toggleGoalLog(state, goalId, dateKey, todayKey = dateKey) {
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

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getBudgetForMonth(state, monthKey) {
  return state.budgets[monthKey] || { total: 0, categories: {} };
}

export function setBudgetForMonth(state, monthKey, budget) {
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

export function upsertRecurringExpense(state, item) {
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

export function deleteRecurringExpense(state, recurringId) {
  state.recurringExpenses = state.recurringExpenses.filter((item) => item.id !== recurringId);
}

export function syncRecurringExpensesForMonth(state, date = new Date()) {
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

export function getPendingGoalsForDate(state, dateKey) {
  return state.goals.filter((goal) => !isGoalDoneOnDate(state, goal.id, dateKey));
}

export function getRecurringExpensesForDay(state, date = new Date()) {
  const day = date.getDate();
  return state.recurringExpenses.filter((item) => Number(item.day) === day);
}

export function getExpenseSummaryForMonth(state, monthKey) {
  const expenses = state.expenses.filter((expense) => expense.date.startsWith(monthKey));
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = expenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amount;
    return accumulator;
  }, {});
  return { expenses, spent, byCategory };
}

export function changeMonth(state, delta) {
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
