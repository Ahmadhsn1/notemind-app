// Standard SM-2 algorithm (SuperMemo 2, Piotr Wozniak 1987) — the same
// scheduling algorithm Anki and most flashcard apps are built on.
// quality: 0-5 (0 = total blackout, 5 = perfect recall). < 3 resets the card
// to "learning again" (interval back to 1 day); >= 3 advances it.
const MIN_EASE_FACTOR = 1.3;

const applySM2 = ({easeFactor, interval, repetitions}, quality) => {
  const newEase = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  let newRepetitions;
  let newInterval;
  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1;
  } else {
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) newInterval = 1;
    else if (newRepetitions === 2) newInterval = 6;
    else newInterval = Math.round(interval * newEase);
  }

  const dueDate = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000);
  return {easeFactor: newEase, interval: newInterval, repetitions: newRepetitions, dueDate};
};

module.exports = {applySM2};
