import { t } from "../i18n/index.js";
import { localizedAmounts } from "./units.js";
import * as D from "../domain.js";
import { dateText, number, amount, percent, habitName } from "./format.js";

export function createStatisticsView({ dom, store, now, render }) {
  const { byId, node, button, fragment, on } = dom;
  const statsPresets = [
    ["7d", t("7 days")],
    ["week", t("This week")],
    ["30d", t("30 days")],
    ["month", t("Current month")],
    ["year", t("Year")],
    ["current-year", t("This year")],
    ["custom", t("Custom period")]
  ];
  let statsPreset = "7d",
    statsRange = null,
    statsFilter = "all",
    statsHidden = true;
  function renderStatsPresets() {
    byId("stats-form").hidden = statsPreset !== "custom";
    for (const el of byId("stats-presets").children)
      el.setAttribute("aria-pressed", String(el.dataset.preset === statsPreset));
  }
  function metricCell(label, value) {
    const cell = node("td");
    cell.setAttribute("role", "cell");
    const heading = node("span", label, "stats-cell-label");
    heading.setAttribute("aria-hidden", "true");
    cell.append(heading, node("span", value, "stats-value"));
    return cell;
  }
  function renderStatistics(state, today) {
    if (!state) {
      byId("stats-metrics").replaceChildren();
      byId("stats-rows").replaceChildren();
      byId("stats-note").textContent = t("Wait for the history to load.");
      return;
    }
    if (statsPreset !== "custom" || !statsRange)
      statsRange = D.periodRange(statsPreset === "custom" ? "7d" : statsPreset, today);
    byId("stats-from").value = statsRange.from;
    byId("stats-to").value = statsRange.to;
    byId("stats-from").max = today;
    byId("stats-to").max = today;
    renderStatsPresets();
    byId("stats-hidden").setAttribute("aria-pressed", String(statsHidden));
    let data;
    try {
      data = D.statistics(state, statsRange.from, statsRange.to, today, statsFilter, statsHidden);
    } catch (e) {
      byId("stats-note").textContent = e.message;
      byId("stats-metrics").replaceChildren();
      byId("stats-rows").replaceChildren();
      return;
    }
    const metrics = fragment();
    for (const [label, value, hint] of [
      [
        t("Quantity"),
        data.total.amounts.length
          ? localizedAmounts(data.total.amounts)
              .map((item) => amount(item.value, item.unit))
              .join(" · ")
          : "—",
        t("By unit, including today")
      ],
      [
        t("Successful days"),
        data.total.completedDays
          ? number(data.total.successDays) + " / " + number(data.total.completedDays)
          : "—",
        t("Completed days for each habit")
      ],
      [
        t("Completion"),
        percent(data.total.successRate),
        t("Completed days across all selected habits")
      ]
    ]) {
      const card = node("div", undefined, "stat-metric");
      card.title = hint;
      card.append(node("span", label), node("strong", value));
      metrics.append(card);
    }
    byId("stats-metrics").replaceChildren(metrics);
    const content = fragment();
    for (const row of data.rows) {
      const tr = node("tr"),
        name = node("th");
      tr.setAttribute("role", "row");
      name.setAttribute("role", "rowheader");
      name.scope = "row";
      name.append(node("span", habitName(row)));
      if (row.archived) name.append(node("small", t("Archived")));
      if (row.tracking === "check-in")
        name.append(node("small", t("Unmarked days: ") + row.unmarkedDays));
      if (!row.trackedDays) name.append(node("small", t("No data")));
      tr.title = row.trackedDays
        ? t("Unsuccessful days: ") +
          row.exceededDays +
          t(". Daily average: ") +
          amount(row.average, row.unit)
        : t("Not tracked in this period");
      tr.append(
        name,
        metricCell(t("Total"), amount(row.events, row.unit)),
        metricCell(
          t("Successful"),
          row.completedDays ? number(row.successDays) + " / " + number(row.completedDays) : "—"
        )
      );
      const share = metricCell(t("Completion"), percent(row.successRate));
      const value = share.lastElementChild;
      if (row.successRate !== null) {
        const bar = node("progress");
        bar.max = 1;
        bar.value = row.successRate;
        bar.setAttribute("aria-label", t("Successful day rate: ") + row.name);
        value.append(bar);
      }
      tr.append(share);
      content.append(tr);
    }
    if (!data.rows.length) {
      const tr = node("tr"),
        td = node("td", t("No habits match this filter."), "stats-empty");
      tr.setAttribute("role", "row");
      td.setAttribute("role", "cell");
      td.colSpan = 4;
      tr.append(td);
      content.append(tr);
    }
    byId("stats-rows").replaceChildren(content);
    byId("stats-caption").textContent =
      dateText(data.from, { month: "short" }) +
      " — " +
      dateText(data.to, { year: "numeric", month: "short" });
    byId("stats-caption").hidden = statsPreset === "custom";
    byId("stats-note").textContent =
      t(
        "A successful day meets the at-most limit or the at-least minimum. Only completed days are assessed. No entries count as zero. Volume, quantity and averages include today when it is in the period. "
      ) +
      t(
        "Days before tracking and after archiving are excluded. Each day uses its own rule; frequency checks include the previous N days, even if part of that interval precedes the selected statistics period. "
      ) +
      t("The total rate counts days for each habit, rather than unique calendar dates.") +
      " " +
      t(
        "Check-in totals count successful marks. Unmarked days stay unknown and are excluded from their completion rate. The successful-day fraction still shows all scheduled completed days."
      );
  }
  byId("stats-presets").replaceChildren();
  for (const [key, label] of statsPresets) {
    const el = button(label, () => {
      statsPreset = key;
      byId("stats-to").setCustomValidity("");
      if (key !== "custom" && store.snapshot().state) statsRange = D.periodRange(key, now());
      render();
      if (key === "custom") byId("stats-from").focus();
    });
    el.dataset.preset = key;
    el.setAttribute("aria-pressed", String(key === statsPreset));
    byId("stats-presets").append(el);
  }
  on("stats-form", "submit", (event) => {
    event.preventDefault();
    byId("stats-to").setCustomValidity("");
    const from = byId("stats-from").value,
      to = byId("stats-to").value;
    if (from > to)
      byId("stats-to").setCustomValidity(t("The end date must not be before the start date."));
    if (!byId("stats-form").reportValidity()) return;
    statsPreset = "custom";
    statsRange = { from, to };
    render();
  });
  const changeRange = () => {
    byId("stats-to").setCustomValidity("");
    statsPreset = "custom";
    renderStatsPresets();
  };
  on("stats-from", "input", changeRange);
  on("stats-to", "input", changeRange);
  on("stats-hidden", "click", () => {
    statsHidden = !statsHidden;
    render();
  });
  on("stats-filter", "change", (event) => {
    statsFilter = event.target.value;
    render();
  });
  return { render: renderStatistics };
}
