import { $, formatDisplayDate, parseDateKey } from "../core/utils.js";
import { getRecentReviewEntries, getReviewEntryByDate } from "../core/state.js";

export function initReviewPage(context) {
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
