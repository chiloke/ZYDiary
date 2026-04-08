import { WEEKDAYS } from "../core/constants.js";
import { $, parseDateKey } from "../core/utils.js";
import { changeMonth, deleteGoal, getGoalCompletedDates, isGoalDoneOnDate, normalizeGoal, removeAuraEvent, setAuraEvent, syncAllGoalsBonus, toggleGoalLog, updateGoal } from "../core/state.js";

function parsePoolInput(value, fallback) {
  const items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function formatPoolInput(pool) {
  return (pool || []).join("\n");
}

export function initGoalsPage(context) {
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
