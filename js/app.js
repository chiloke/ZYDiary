import { REALMS, getDefaultState } from "./core/constants.js";
import { createDust } from "./core/dust.js";
import { getMonthlyReport, getWeeklyReport } from "./core/reports.js";
import { initStorage, loadPersistedState, savePersistedState } from "./core/storage.js";
import { getAuraSummary, getPendingGoalsForDate, getRecurringExpensesForDay, isGoalDoneOnDate, mergeState, syncAllGoalsBonus, syncRecurringExpensesForMonth, syncVisitStreak } from "./core/state.js";
import { $, formatDateKey, startOfDay } from "./core/utils.js";
import { initGoalsPage } from "./pages/goals.js";
import { initDailyPage } from "./pages/daily.js";
import { initHomePage } from "./pages/home.js";
import { initLedgerPage } from "./pages/ledger.js";
import { initProfilePage } from "./pages/profile.js";
import { initReportsPage } from "./pages/reports.js";
import { initReviewPage } from "./pages/review.js";

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
