import { $, formatTimestamp } from "../core/utils.js";
import { buildReviewSummary, getReviewEntryByDate, setAuraEvent, upsertReviewEntry } from "../core/state.js";

export function initDailyPage(context) {
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
