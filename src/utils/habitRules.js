export const HABITS_CONFIG = [
  { id: 'sport', name: 'Спорт', icon: 'Dumbbell' },
  { id: 'reading', name: 'Чтение', icon: 'BookOpen' },
  { id: 'self_dev', name: 'Саморазвитие', icon: 'Brain' },
  { id: 'exercise', name: 'Зарядка', icon: 'Zap' },
  { id: 'sleep', name: 'Режим сна', icon: 'Moon' },
  { id: 'nutrition', name: 'Питание', icon: 'Utensils' },
];

export const SCORE_LEVELS = {
  0: { label: 'Плохо', bg: 'bg-red-500', hex: '#EF4444', text: 'text-red-400' },
  1: { label: 'Удовлетворительно', bg: 'bg-orange-500', hex: '#F97316', text: 'text-orange-400' },
  2: { label: 'Хорошо', bg: 'bg-yellow-500', hex: '#EAB308', text: 'text-yellow-400' },
  3: { label: 'Отлично', bg: 'bg-green-500', hex: '#22C55E', text: 'text-green-400' },
  4: { label: 'Превосходно', bg: 'bg-sky-400', hex: '#38BDF8', text: 'text-sky-300' },
};

// 1. Спорт
export function calculateSportScore(data = {}) {
  const steps = Number(data.steps) || 0;
  const runKm = Number(data.runKm) || 0;
  const workoutMin = Number(data.workoutMin) || 0;
  const cyclingKm = Number(data.cyclingKm) || 0;

  if (steps >= 30000 || runKm >= 10 || workoutMin >= 90 || cyclingKm >= 20) return 4;
  if (steps >= 15000 || runKm >= 6 || workoutMin >= 60 || cyclingKm >= 10) return 3;
  if (steps >= 10000 || runKm >= 4 || workoutMin >= 40 || cyclingKm >= 7) return 2;
  if (steps >= 5000 || runKm >= 2 || workoutMin >= 20 || cyclingKm >= 4) return 1;
  return 0;
}

// 2. Чтение
export function calculateReadingScore(data = {}) {
  const book = Number(data.bookPages) || 0;
  const phone = Number(data.phonePages) || 0;
  const total = book + phone / 1.5;

  if (total >= 40) return 4;
  if (total >= 30) return 3;
  if (total >= 20) return 2;
  if (total >= 10) return 1;
  return 0;
}

// 3. Саморазвитие
export function calculateSelfDevScore(data = {}) {
  const minutes = Number(data.minutes) || 0;
  if (minutes >= 60) return 4;
  if (minutes >= 40) return 3;
  if (minutes >= 20) return 2;
  if (minutes >= 10) return 1;
  return 0;
}

// 4. Зарядка
export function calculateExerciseScore(data = {}) {
  const level = Number(data.level) || 0;
  return Math.min(Math.max(level, 0), 4);
}

// 5. Сон (среднее из двух параметров)
export function calculateSleepScore(data = {}) {
  const bedTime = data.bedTime || '';
  const duration = Number(data.durationHours) || 0;
  if (!bedTime && duration === 0) return 0;

  let bedScore = 0;
  if (bedTime) {
    const [h, m] = bedTime.split(':').map(Number);
    const totalMinutes = h * 60 + m;

    if (totalMinutes <= 22 * 60 + 30 && totalMinutes >= 18 * 60) {
      bedScore = 4;
    } else if (totalMinutes <= 23 * 60 && totalMinutes > 22 * 60 + 30) {
      bedScore = 3;
    } else if (totalMinutes <= 23 * 60 + 30 && totalMinutes > 23 * 60) {
      bedScore = 2;
    } else if (totalMinutes <= 24 * 60 && totalMinutes > 23 * 60 + 30) {
      bedScore = 1;
    } else {
      bedScore = 0;
    }
  }

  let durScore = 0;
  if (duration >= 8.0) durScore = 4;
  else if (duration >= 7.5) durScore = 3;
  else if (duration >= 7.0) durScore = 2;
  else if (duration >= 6.5) durScore = 1;
  else durScore = 0;

  return Math.round((bedScore + durScore) / 2);
}

// 6. Питание (округленное среднее из 3 параметров)
export function calculateNutritionScore(data = {}) {
  const junk = data.junkKcal !== '' && data.junkKcal !== undefined ? Number(data.junkKcal) : 9999;
  const fv = Number(data.fruitsVeggies) || 0;
  const protein = Number(data.proteinGrams) || 0;

  if (junk === 9999 && fv === 0 && protein === 0) return 0;

  let junkScore = 0;
  if (junk === 0) junkScore = 4;
  else if (junk <= 200) junkScore = 3;
  else if (junk <= 400) junkScore = 2;
  else if (junk <= 600) junkScore = 1;
  else junkScore = 0;

  let fvScore = 0;
  if (fv >= 5) fvScore = 4;
  else if (fv >= 3) fvScore = 3;
  else if (fv >= 2) fvScore = 2;
  else if (fv >= 1) fvScore = 1;
  else fvScore = 0;

  let proteinScore = 0;
  if (protein >= 144) proteinScore = 4;
  else if (protein >= 120) proteinScore = 3;
  else if (protein >= 100) proteinScore = 2;
  else if (protein >= 72) proteinScore = 1;
  else proteinScore = 0;

  return Math.round((junkScore + fvScore + proteinScore) / 3);
}

export function evaluateAllScores(dayData = {}) {
  return {
    sport: calculateSportScore(dayData.sport),
    reading: calculateReadingScore(dayData.reading),
    self_dev: calculateSelfDevScore(dayData.self_dev),
    exercise: calculateExerciseScore(dayData.exercise),
    sleep: calculateSleepScore(dayData.sleep),
    nutrition: calculateNutritionScore(dayData.nutrition),
  };
}

// Формула листа «Трекер активностей 2»
export function calculateMonthlyHabitStats(effectiveDays, scoresArray, totalDaysInMonth, isCurrentMonth) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

  // Если будущий месяц еще не наступил
  if (effectiveDays <= 0) {
    return {
      counts,
      percentages: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      average: 0,
      effectiveDays: 0,
      totalDays: totalDaysInMonth,
      isCurrentMonth: false,
    };
  }

  // Учитываем оценки только за реально прожитые дни (от 1 до effectiveDays)
  const daysToCount = scoresArray.slice(0, effectiveDays);
  daysToCount.forEach(val => {
    const s = Number(val);
    if (counts[s] !== undefined) counts[s] += 1;
    else counts[0] += 1;
  });

  // Проценты распределения считаем от фактически прожитых дней
  const percentages = {
    0: (counts[0] / effectiveDays) * 100,
    1: (counts[1] / effectiveDays) * 100,
    2: (counts[2] / effectiveDays) * 100,
    3: (counts[3] / effectiveDays) * 100,
    4: (counts[4] / effectiveDays) * 100,
  };

  // Средний балл: делим на количество прошедших дней
  const weightedSum = counts[1] * 1 + counts[2] * 2 + counts[3] * 3 + counts[4] * 4;
  const average = weightedSum / effectiveDays;

  return {
    counts,
    percentages,
    average,
    effectiveDays,
    totalDays: totalDaysInMonth,
    isCurrentMonth,
  };
}