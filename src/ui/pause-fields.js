import { t } from "../i18n/index.js";
import { mergePauses } from "../scheduling.js";
import { addDays } from "../domain.js";

export function createPauseFields(dom) {
  const { byId, node, button } = dom;
  const root = byId("pause-fields");
  let pauses = [],
    today = "";
  const label = (text, input) => {
    const el = node("label", text);
    el.append(input);
    return el;
  };
  const from = node("input"),
    to = node("input"),
    ongoing = node("input");
  Object.assign(from, { type: "date", id: "pause-from" });
  Object.assign(to, { type: "date", id: "pause-to" });
  ongoing.type = "checkbox";
  const list = node("div"),
    message = node("p", "", "form-error");
  message.setAttribute("role", "alert");
  const add = button(t("Add pause or exception"), () => {
    message.textContent = "";
    if (!from.value || (!ongoing.checked && (!to.value || to.value < from.value))) {
      message.textContent = t("Choose a pause start and an end on or after it.");
      return;
    }
    if (!from.checkValidity() || (!ongoing.checked && !to.checkValidity())) return;
    pauses = mergePauses(pauses, { from: from.value, to: ongoing.checked ? null : to.value });
    render();
  });
  const row = node("div", undefined, "form-row");
  row.append(label(t("Pause from"), from), label(t("Pause through"), to));
  const check = label(t("Until resumed"), ongoing);
  check.className = "check-label";
  ongoing.addEventListener("change", () => {
    to.disabled = ongoing.checked;
  });
  root.append(
    node("legend", t("Pauses and exceptions")),
    row,
    check,
    add,
    list,
    message,
    node(
      "p",
      t(
        "Pause dates are inclusive. Recorded values stay in totals; paused days do not earn or break streaks."
      ),
      "hint"
    )
  );
  function render() {
    list.replaceChildren();
    for (const pause of pauses) {
      const row = node("div", undefined, "actions");
      row.append(node("span", pause.from + " — " + (pause.to ?? t("Until resumed"))));
      if (!pause.to && pause.from <= today)
        row.append(
          button(t("Resume today"), () => {
            pauses = pauses.filter((item) => item !== pause);
            if (pause.from < today)
              pauses = mergePauses(pauses, { from: pause.from, to: addDays(today, -1) });
            render();
          })
        );
      row.append(
        button(t("Remove pause"), () => {
          pauses = pauses.filter((item) => item !== pause);
          render();
        })
      );
      list.append(row);
    }
  }
  return {
    update(linked) {
      root.hidden = linked;
      for (const input of [from, to, ongoing, add]) input.disabled = linked;
      to.disabled = linked || ongoing.checked;
    },
    open(habit, date, currentDate) {
      pauses = structuredClone(habit?.pauses ?? []);
      today = currentDate;
      from.value = to.value = date;
      from.min = to.min = habit?.startDate ?? date;
      from.max = to.max = habit?.endDate ?? "9999-12-31";
      ongoing.checked = false;
      message.textContent = "";
      render();
    },
    value() {
      return root.hidden ? undefined : pauses;
    }
  };
}
