export const SM2_MIN_EASE = 1.3;

export function sm2Next(card, quality, now = new Date()) {
  const q = Number(quality);
  if (!Number.isInteger(q) || q < 0 || q > 5) {
    throw new Error("SM-2 质量分必须是 0-5 的整数");
  }
  const ease = Number.isFinite(card?.ease) && card.ease > 0 ? card.ease : 2.5;
  const reps = Number.isInteger(card?.reps) && card.reps > 0 ? card.reps : 0;
  const lapses = Number.isInteger(card?.lapses) && card.lapses > 0 ? card.lapses : 0;
  const prevInterval = Number.isFinite(card?.intervalDays) && card.intervalDays > 0 ? card.intervalDays : 0;

  let nextEase = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (nextEase < SM2_MIN_EASE) nextEase = SM2_MIN_EASE;

  let nextReps;
  let nextInterval;
  let nextLapses = lapses;
  if (q < 3) {
    nextReps = 0;
    nextInterval = 1;
    nextLapses = lapses + 1;
  } else {
    nextReps = reps + 1;
    nextInterval = nextReps === 1 ? 1 : nextReps === 2 ? 6 : Math.round(prevInterval * ease);
  }

  const due = new Date(now.getTime() + nextInterval * 86400000);
  return {
    ease: Math.round(nextEase * 100) / 100,
    intervalDays: nextInterval,
    reps: nextReps,
    lapses: nextLapses,
    dueAt: due.toISOString().slice(0, 10),
  };
}
