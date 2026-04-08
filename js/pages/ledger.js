import { $ } from "../core/utils.js";
import { deleteRecurringExpense, getBudgetForMonth, getExpenseSummaryForMonth, getMonthKey, setBudgetForMonth, syncRecurringExpensesForMonth, upsertRecurringExpense } from "../core/state.js";

export function initLedgerPage(context) {
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
