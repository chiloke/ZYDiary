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

export function getWeeklyReport(state, now = new Date()) {
  const today = startOfDay(now);
  return buildRangeReport(state, startOfWeek(today), endOfWeek(today), "本周");
}

export function getMonthlyReport(state, now = new Date()) {
  const today = startOfDay(now);
  return buildRangeReport(state, startOfMonth(today), endOfMonth(today), "本月");
}

export function formatRangeLabel(start, end) {
  const startDate = parseDateKey(formatDateKey(start));
  const endDate = parseDateKey(formatDateKey(end));
  return `${startDate.getMonth() + 1}.${String(startDate.getDate()).padStart(2, "0")} - ${endDate.getMonth() + 1}.${String(endDate.getDate()).padStart(2, "0")}`;
}
