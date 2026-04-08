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
