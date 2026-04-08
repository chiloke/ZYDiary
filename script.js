const STORAGE_KEY = "zy-diary-state";
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const TODAY = new Date();
const TODAY_KEY = formatDateKey(TODAY);
const TODAY_DAY = TODAY.getDate();

const REALMS = [
  { name: "练气一重", aura: 0, ability: "开启每日复盘" },
  { name: "练气三重", aura: 5, ability: "解锁目标奖励转盘" },
  { name: "练气六重", aura: 12, ability: "解锁多目标修行视图" },
  { name: "练气九重", aura: 20, ability: "解锁消费图表洞察" },
  { name: "筑基一重", aura: 32, ability: "解锁境界形象升级" },
  { name: "筑基三重", aura: 48, ability: "解锁长期习惯专注模式" },
  { name: "结丹初期", aura: 68, ability: "解锁阶段性里程碑记录" },
  { name: "元婴初期", aura: 95, ability: "解锁年度回望仪式" },
  { name: "化神初期", aura: 132, ability: "解锁全域修行总览" }
];

const DEFAULT_STATE = {
  activeGoalId: "run",
  review: {
    win: "",
    block: "",
    next: "",
    savedAt: "",
    rewardedDate: ""
  },
  annotations: [
    { time: "2026-03-20 21:16", text: "回头看，这一天是重新建立运动自信的转折点。" },
    { time: "2026-04-02 22:03", text: "现在再看，发现当时最宝贵的不是配速，而是“还是出了门”。" }
  ],
  goals: [
    {
      id: "run",
      name: "跑步 2 公里",
      type: "运动类",
      completedDays: [1, 2, 4, 5, 7, 9, 10, 11, 13, 14, 15, 18, 19, 21, 23, 24, 25, 26, 28, 29],
      rewardPool: ["今晚看一部电影", "加一份喜欢的甜点", "解锁 30 分钟自由娱乐"],
      penaltyPool: ["做 20 个深蹲", "今晚少刷 30 分钟手机", "额外快走 1 公里"]
    },
    {
      id: "study",
      name: "英语学习 40 分钟",
      type: "学习类",
      completedDays: [1, 3, 4, 5, 6, 8, 9, 11, 12, 13, 16, 17, 18, 19, 21, 22, 24, 26, 27, 29],
      rewardPool: ["听一张喜欢的专辑", "给自己泡一杯好喝的咖啡", "买一本想看的电子书"],
      penaltyPool: ["补做 15 分钟听力", "写 10 个新单词", "明早提前 20 分钟起床"]
    },
    {
      id: "habit",
      name: "23:30 前睡觉",
      type: "习惯类",
      completedDays: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 23, 24, 27, 28, 30],
      rewardPool: ["明早早餐升级", "允许赖床 10 分钟", "买一支新笔"],
      penaltyPool: ["明天午休前不碰零食", "睡前做 10 分钟拉伸", "写一段晚睡原因复盘"]
    }
  ],
  expenses: [
    { id: "e1", date: "2026-04-01", title: "午饭", category: "饮食", amount: 28 },
    { id: "e2", date: "2026-04-02", title: "线上课程订阅", category: "学习", amount: 89 },
    { id: "e3", date: "2026-04-03", title: "地铁出行", category: "出行", amount: 12 },
    { id: "e4", date: "2026-04-04", title: "周末电影票", category: "娱乐", amount: 56 },
    { id: "e5", date: "2026-04-05", title: "咖啡与面包", category: "饮食", amount: 34 },
    { id: "e6", date: TODAY_KEY, title: "跑步护膝", category: "生活", amount: 92 }
  ],
  auraEvents: {}
};

let state = loadState();
let activeGoal = getActiveGoal();

init();

function init() {
  createDust();
  initHomePage();
  initReviewPage();
  initGoalsPage();
  initLedgerPage();
  initProfilePage();
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    const parsed = JSON.parse(raw);
    return {
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      ...parsed,
      review: { ...DEFAULT_STATE.review, ...parsed.review },
      auraEvents: parsed.auraEvents || {},
      goals: parsed.goals || JSON.parse(JSON.stringify(DEFAULT_STATE.goals)),
      expenses: parsed.expenses || JSON.parse(JSON.stringify(DEFAULT_STATE.expenses)),
      annotations: parsed.annotations || JSON.parse(JSON.stringify(DEFAULT_STATE.annotations))
    };
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveGoal() {
  return state.goals.find((goal) => goal.id === state.activeGoalId) || state.goals[0];
}

function initHomePage() {
  if (document.body.dataset.page !== "home") return;
  syncOverviewStats();
  renderAuraTimeline(document.getElementById("auraTimeline"));
  renderAbilityList(document.getElementById("unlockedAbilities"));
  updateRealmWidgets();
}

function initReviewPage() {
  if (document.body.dataset.page !== "review") return;
  const reviewWin = document.getElementById("reviewWin");
  const reviewBlock = document.getElementById("reviewBlock");
  const reviewNext = document.getElementById("reviewNext");
  const saveReviewButton = document.getElementById("saveReviewButton");
  const reviewSavedMessage = document.getElementById("reviewSavedMessage");
  const annotationInput = document.getElementById("annotationInput");
  const saveAnnotationButton = document.getElementById("saveAnnotationButton");
  const annotationSavedMessage = document.getElementById("annotationSavedMessage");

  reviewWin.value = state.review.win;
  reviewBlock.value = state.review.block;
  reviewNext.value = state.review.next;
  reviewSavedMessage.textContent = state.review.savedAt ? `最近保存于 ${state.review.savedAt}` : "尚未保存";

  saveReviewButton.addEventListener("click", () => {
    state.review.win = reviewWin.value.trim();
    state.review.block = reviewBlock.value.trim();
    state.review.next = reviewNext.value.trim();
    state.review.savedAt = formatTimestamp(new Date());
    reviewSavedMessage.textContent = `最近保存于 ${state.review.savedAt}`;

    if (state.review.rewardedDate !== TODAY_KEY) {
      state.review.rewardedDate = TODAY_KEY;
      setAuraEvent(`review-${TODAY_KEY}`, 1, "完成今日复盘");
    }

    persistState();
    updateRealmWidgets();
  });

  saveAnnotationButton.addEventListener("click", () => {
    const text = annotationInput.value.trim();
    if (!text) {
      annotationSavedMessage.textContent = "请先输入一条批注内容";
      return;
    }

    state.annotations.unshift({ time: formatTimestamp(new Date()), text });
    annotationInput.value = "";
    annotationSavedMessage.textContent = `已保存，记录时间 ${state.annotations[0].time}`;
    persistState();
    renderAnnotations();
  });

  renderAnnotations();
  updateRealmWidgets();
}

function initGoalsPage() {
  if (document.body.dataset.page !== "goals") return;
  const goalTabs = document.getElementById("goalTabs");
  const goalSummary = document.getElementById("goalSummary");
  const calendarGrid = document.getElementById("calendarGrid");
  const spinButton = document.getElementById("spinButton");
  const wheelStateText = document.getElementById("wheelStateText");
  const wheelResult = document.getElementById("wheelResult");
  const toggleTodayButton = document.getElementById("toggleTodayButton");
  const goalActionMessage = document.getElementById("goalActionMessage");
  const addGoalButton = document.getElementById("addGoalButton");
  const goalFormMessage = document.getElementById("goalFormMessage");

  function renderGoalTabs() {
    goalTabs.innerHTML = "";
    state.goals.forEach((goal) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `goal-tab${goal.id === activeGoal.id ? " active" : ""}`;
      button.textContent = goal.name;
      button.addEventListener("click", () => {
        state.activeGoalId = goal.id;
        activeGoal = goal;
        persistState();
        renderGoalTabs();
        renderCalendar();
        wheelResult.textContent = "等待转动";
      });
      goalTabs.appendChild(button);
    });
  }

  function renderCalendar() {
    calendarGrid.innerHTML = "";
    WEEKDAYS.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "calendar-weekday";
      cell.textContent = day;
      calendarGrid.appendChild(cell);
    });

    goalSummary.textContent = `${activeGoal.type} · 本月已完成 ${activeGoal.completedDays.length} / 31 天`;
    for (let day = 1; day <= 31; day += 1) {
      const cell = document.createElement("div");
      const done = activeGoal.completedDays.includes(day);
      cell.className = `calendar-day${done ? " done" : ""}${day === TODAY_DAY ? " today" : ""}`;
      cell.textContent = day;
      calendarGrid.appendChild(cell);
    }

    const doneToday = activeGoal.completedDays.includes(TODAY_DAY);
    wheelStateText.textContent = doneToday
      ? `今天已经完成「${activeGoal.name}」，可以抽取奖励。`
      : `今天还未完成「${activeGoal.name}」，需要接受一次惩罚。`;
    toggleTodayButton.textContent = doneToday ? "取消今日打卡" : "今日完成打卡";
  }

  toggleTodayButton.addEventListener("click", () => {
    const goal = state.goals.find((item) => item.id === activeGoal.id);
    const doneToday = goal.completedDays.includes(TODAY_DAY);
    goal.completedDays = doneToday
      ? goal.completedDays.filter((day) => day !== TODAY_DAY)
      : [...goal.completedDays, TODAY_DAY].sort((left, right) => left - right);

    if (doneToday) {
      removeAuraEvent(`goal-${goal.id}-${TODAY_KEY}`);
      goalActionMessage.textContent = `已将「${goal.name}」恢复为未完成状态。`;
    } else {
      setAuraEvent(`goal-${goal.id}-${TODAY_KEY}`, 1, `完成目标：${goal.name}`);
      goalActionMessage.textContent = `已记录今天完成了「${goal.name}」。`;
    }

    syncAllGoalsBonus();
    activeGoal = goal;
    persistState();
    renderGoalTabs();
    renderCalendar();
    wheelResult.textContent = "等待转动";
  });

  spinButton.addEventListener("click", () => {
    const doneToday = activeGoal.completedDays.includes(TODAY_DAY);
    const pool = doneToday ? activeGoal.rewardPool : activeGoal.penaltyPool;
    const label = doneToday ? "今日奖励" : "今日惩罚";
    const choice = pool[Math.floor(Math.random() * pool.length)];
    wheelResult.textContent = `${label}：${choice}`;
  });

  addGoalButton.addEventListener("click", () => {
    const name = document.getElementById("goalNameInput").value.trim();
    const type = document.getElementById("goalTypeInput").value;
    const reward = document.getElementById("goalRewardInput").value.trim();
    const penalty = document.getElementById("goalPenaltyInput").value.trim();

    if (!name) {
      goalFormMessage.textContent = "请先输入目标名称";
      return;
    }

    const goal = {
      id: `goal-${Date.now()}`,
      name,
      type,
      completedDays: [],
      rewardPool: reward ? [reward, "今晚可以自由安排 30 分钟", "给自己一杯喜欢的饮品"] : ["今晚可以自由安排 30 分钟"],
      penaltyPool: penalty ? [penalty, "补做 10 分钟复盘", "今晚少刷 20 分钟手机"] : ["补做 10 分钟复盘"]
    };

    state.goals.push(goal);
    state.activeGoalId = goal.id;
    activeGoal = goal;
    persistState();
    goalFormMessage.textContent = `已新增目标「${goal.name}」`;
    document.getElementById("goalNameInput").value = "";
    document.getElementById("goalRewardInput").value = "";
    document.getElementById("goalPenaltyInput").value = "";
    renderGoalTabs();
    renderCalendar();
    updateRealmWidgets();
  });

  renderGoalTabs();
  renderCalendar();
  updateRealmWidgets();
}

function initLedgerPage() {
  if (document.body.dataset.page !== "ledger") return;
  const expenseList = document.getElementById("expenseList");
  const barChart = document.getElementById("barChart");
  const pieChart = document.getElementById("pieChart");
  const pieLegend = document.getElementById("pieLegend");
  const ledgerLegend = document.getElementById("ledgerLegend");
  const addExpenseButton = document.getElementById("addExpenseButton");
  const expenseFormMessage = document.getElementById("expenseFormMessage");

  bindLedgerToggle();

  addExpenseButton.addEventListener("click", () => {
    const title = document.getElementById("expenseTitleInput").value.trim();
    const category = document.getElementById("expenseCategoryInput").value;
    const amount = Number(document.getElementById("expenseAmountInput").value);

    if (!title || !amount) {
      expenseFormMessage.textContent = "请补全消费名称和金额";
      return;
    }

    state.expenses.unshift({
      id: `expense-${Date.now()}`,
      date: TODAY_KEY,
      title,
      category,
      amount
    });

    persistState();
    expenseFormMessage.textContent = `已新增消费「${title}」`;
    document.getElementById("expenseTitleInput").value = "";
    document.getElementById("expenseAmountInput").value = "";
    renderExpenses(expenseList);
    renderExpenseCharts(barChart, pieChart, pieLegend, ledgerLegend);
    updateRealmWidgets();
  });

  renderExpenses(expenseList);
  renderExpenseCharts(barChart, pieChart, pieLegend, ledgerLegend);
  updateRealmWidgets();
}

function initProfilePage() {
  if (document.body.dataset.page !== "profile") return;
  updateRealmWidgets();
  renderAbilityList(document.getElementById("profileAbilities"));
  renderRealmList(document.getElementById("realmList"));
  renderAuraTimeline(document.getElementById("profileTimeline"));
}

function renderAnnotations() {
  const annotationList = document.querySelector(".annotation-list");
  const annotationCount = document.getElementById("annotationCount");
  if (!annotationList) return;
  annotationList.innerHTML = "";
  state.annotations.forEach((annotation) => {
    const article = document.createElement("article");
    article.innerHTML = `<time>${annotation.time}</time><p>${annotation.text}</p>`;
    annotationList.appendChild(article);
  });
  if (annotationCount) annotationCount.textContent = `已复盘 ${state.annotations.length} 次`;
}

function renderExpenses(target) {
  target.innerHTML = "";
  state.expenses.forEach((expense) => {
    const item = document.createElement("article");
    const color = colorClassForCategory(expense.category);
    item.className = "expense-item";
    item.innerHTML = `
      <div class="expense-icon ${color}">${expense.date.slice(8)}</div>
      <div class="expense-meta">
        <strong>${expense.title}</strong>
        <span>${expense.category} · ${expense.date}</span>
      </div>
      <strong class="expense-amount">¥${expense.amount.toFixed(2)}</strong>
    `;
    target.appendChild(item);
  });
}

function renderExpenseCharts(barChart, pieChart, pieLegend, ledgerLegend) {
  const latestSix = state.expenses.slice(0, 6).reverse();
  const max = Math.max(...latestSix.map((item) => item.amount), 1);
  barChart.innerHTML = "";

  latestSix.forEach((item) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    const height = `${Math.max(20, (item.amount / max) * 180)}px`;
    bar.innerHTML = `<i style="height:${height};"></i><strong>¥${item.amount.toFixed(0)}</strong><span>${item.date.slice(5)}</span>`;
    barChart.appendChild(bar);
  });

  const categoryTotals = state.expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const palette = {
    饮食: "#d97a57",
    学习: "#5d8f76",
    出行: "#6f87c7",
    娱乐: "#c6a458",
    生活: "#8f7580"
  };

  const entries = Object.entries(categoryTotals);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  let current = 0;
  const segments = entries.map(([name, value]) => {
    const start = current;
    current += (value / total) * 100;
    return `${palette[name] || "#aaa"} ${start}% ${current}%`;
  });
  pieChart.style.background = `conic-gradient(${segments.join(", ")})`;

  pieLegend.innerHTML = "";
  ledgerLegend.innerHTML = "";
  entries.forEach(([name, value]) => {
    const legendItem = `<span class="legend-item"><i class="legend-dot" style="background:${palette[name] || "#aaa"}"></i>${name} ¥${value.toFixed(0)}</span>`;
    pieLegend.insertAdjacentHTML("beforeend", legendItem);
    ledgerLegend.insertAdjacentHTML("beforeend", legendItem);
  });
}

function bindLedgerToggle() {
  const toggles = document.querySelectorAll(".toggle");
  const listView = document.getElementById("listView");
  const chartView = document.getElementById("chartView");
  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggles.forEach((item) => item.classList.remove("active"));
      toggle.classList.add("active");
      const showChart = toggle.dataset.view === "chart";
      listView.classList.toggle("active", !showChart);
      chartView.classList.toggle("active", showChart);
    });
  });
}

function syncAllGoalsBonus() {
  const allDone = state.goals.length > 0 && state.goals.every((goal) => goal.completedDays.includes(TODAY_DAY));
  if (allDone) {
    setAuraEvent(`all-goals-${TODAY_KEY}`, 3, "完成今日全部目标");
  } else {
    removeAuraEvent(`all-goals-${TODAY_KEY}`);
  }
}

function setAuraEvent(id, amount, label) {
  state.auraEvents[id] = { amount, label, date: TODAY_KEY };
}

function removeAuraEvent(id) {
  delete state.auraEvents[id];
}

function getAuraSummary() {
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

function updateRealmWidgets() {
  const summary = getAuraSummary();
  const currentRealm = summary.currentRealm.name;
  const profileRealm = document.getElementById("profileRealm");
  const profileAura = document.getElementById("profileAura");
  const realmProgress = document.getElementById("realmProgress");
  const reviewRealm = document.getElementById("reviewRealm");
  const reviewAura = document.getElementById("reviewAura");
  const homeRealm = document.getElementById("currentRealm");
  const todayAuraGain = document.getElementById("todayAuraGain");
  const avatarCore = document.getElementById("avatarCore");
  const avatarStage = document.getElementById("avatarStage");

  if (profileRealm) profileRealm.textContent = currentRealm;
  if (profileAura) profileAura.textContent = `灵气 ${summary.total} / ${summary.nextRealm.aura}`;
  if (realmProgress) realmProgress.style.width = `${summary.progress}%`;
  if (reviewRealm) reviewRealm.textContent = currentRealm;
  if (reviewAura) reviewAura.textContent = `灵气 ${summary.total}`;
  if (homeRealm) homeRealm.textContent = currentRealm;
  if (avatarCore && avatarStage) {
    const palettes = [
      ["#ffffff", "#9ac7af", "#2b5441"],
      ["#ffffff", "#aad8cb", "#2f6b67"],
      ["#fff7d6", "#d7c16d", "#7c6631"],
      ["#f4ddff", "#b98de1", "#503172"],
      ["#d9f5ff", "#6db6d1", "#214760"],
    ];
    const palette = palettes[Math.min(Math.floor(summary.realmIndex / 2), palettes.length - 1)];
    avatarCore.style.background = `radial-gradient(circle at 30% 30%, ${palette[0]}, ${palette[1]} 30%, ${palette[2]} 78%)`;
    avatarCore.style.boxShadow = `0 0 ${40 + summary.realmIndex * 4}px ${palette[1]}`;
    avatarStage.style.boxShadow = `inset 0 0 0 1px rgba(35, 76, 58, 0.16), 0 0 ${18 + summary.realmIndex * 4}px rgba(255,255,255,0.3)`;
  }
  if (todayAuraGain) {
    const todayGain = Object.values(state.auraEvents)
      .filter((item) => item.date === TODAY_KEY)
      .reduce((sum, item) => sum + item.amount, 0);
    todayAuraGain.textContent = `${todayGain}`;
  }
  syncOverviewStats();
}

function syncOverviewStats() {
  const todayGoalCount = document.getElementById("todayGoalCount");
  const todayExpenseAmount = document.getElementById("todayExpenseAmount");
  const todayGoals = state.goals.filter((goal) => goal.completedDays.includes(TODAY_DAY)).length;
  const todayExpenses = state.expenses
    .filter((expense) => expense.date === TODAY_KEY)
    .reduce((sum, item) => sum + item.amount, 0);

  if (todayGoalCount) todayGoalCount.textContent = `${todayGoals}`;
  if (todayExpenseAmount) todayExpenseAmount.textContent = `¥${todayExpenses.toFixed(0)}`;
}

function renderAuraTimeline(target) {
  if (!target) return;
  const events = Object.values(state.auraEvents)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);
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
  const summary = getAuraSummary();
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
  const summary = getAuraSummary();
  target.innerHTML = "";
  REALMS.forEach((realm, index) => {
    const item = document.createElement("article");
    item.className = `realm-item${index === summary.realmIndex ? " current" : ""}${index > summary.realmIndex ? " locked" : ""}`;
    item.innerHTML = `<div><strong>${realm.name}</strong><span>${realm.ability}</span></div><span class="tag">需 ${realm.aura} 灵气</span>`;
    target.appendChild(item);
  });
}

function colorClassForCategory(category) {
  const map = {
    饮食: "food",
    学习: "study",
    出行: "travel",
    娱乐: "fun",
    生活: "life"
  };
  return map[category] || "life";
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

function createDust() {
  const canvas = document.getElementById("dustCanvas");
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
