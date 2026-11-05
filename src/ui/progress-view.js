import { t } from "../i18n/index.js";
import { number, habitName } from "./format.js";

export function recordText(progress) {
  return (
    (progress.isRecord ? t("New best: ") : t("Best: ")) +
    (progress.kind === "empty" ? "—" : number(progress.bestDays))
  );
}

export function progressPanel(dom, habit, progress) {
  const { node, button } = dom;
  const panel = node("div", undefined, "habit-progress");
  const meta = node("div", undefined, "habit-progress-meta");
  const goal = node("span", t("Goal: ") + number(progress.nextGoal) + t(" days"));
  goal.append(
    node("span", " · " + t("Remaining: ") + number(progress.remaining), "goal-remaining")
  );
  const achievements = node("div", undefined, "habit-achievements");
  const note = node("div", undefined, "habit-achievement-note");
  note.id = habit.id + "-achievement-note";
  note.hidden = true;
  note.setAttribute("role", "status");
  note.setAttribute("aria-live", "polite");
  let selected = null;
  for (const award of progress.achievements) {
    const label = t("Streak: ") + number(award.days) + t(" days");
    const description =
      label +
      (award.earned ? t(" · earned") : t(" · remaining: ") + number(award.days - progress.days));
    const control = button(
      "",
      () => {
        selected = selected === award.days ? null : award.days;
        for (const item of achievements.children)
          item.setAttribute("aria-expanded", String(item === control && selected !== null));
        note.hidden = selected === null;
        note.textContent =
          label +
          " · " +
          (award.earned
            ? t("Badge earned. Kept after a missed day.")
            : t("This badge requires a streak of ") +
              number(award.days) +
              t(" days") +
              t(" Remaining: ") +
              number(award.days - progress.days));
      },
      habitName(habit) + " · " + description,
      "habit-achievement" + (award.earned ? " earned" : "")
    );
    control.dataset.days = String(award.days);
    control.dataset.earned = String(award.earned);
    control.dataset.focusKey = habit.id + "-award-" + award.days;
    control.title = description;
    control.setAttribute("aria-controls", note.id);
    control.setAttribute("aria-expanded", "false");
    const icon = node("span", undefined, "achievement-icon");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = award.earned
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>';
    control.append(
      icon,
      node("span", number(award.days) + t(" days") + (award.earned ? " ✓" : ""))
    );
    achievements.append(control);
  }
  meta.append(goal, achievements);
  const track = node("div", undefined, "habit-goal-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute(
    "aria-label",
    habitName(habit) + " · " + t("Goal: ") + number(progress.nextGoal) + t(" days")
  );
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(progress.nextGoal));
  track.setAttribute("aria-valuenow", String(progress.days));
  const fill = node("span");
  fill.style.width = (progress.days / progress.nextGoal) * 100 + "%";
  track.append(fill);
  panel.append(meta, track, note);
  return panel;
}
