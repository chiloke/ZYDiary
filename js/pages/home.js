import { $, formatClock, formatCountdown, formatDisplayDate, timeUntilEndOfDay, timeUntilEndOfMonth, timeUntilEndOfYear } from "../core/utils.js";

export function initHomePage(context) {
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
