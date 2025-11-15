/**
 * Get ISO week number for a given date
 * ISO weeks start on Monday and the first week contains January 4th
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the current week number and calculate last/next week numbers
 */
export function getWeekNumbers(): { lastWeek: number; currentWeek: number; nextWeek: number; year: number } {
  const now = new Date();
  const currentWeek = getISOWeekNumber(now);
  const year = now.getFullYear();

  // Calculate last week
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  let lastWeek = getISOWeekNumber(lastWeekDate);
  let lastWeekYear = lastWeekDate.getFullYear();

  // If we're in week 1, last week might be week 52 or 53 of previous year
  if (currentWeek === 1 && lastWeek > 50) {
    lastWeekYear = year - 1;
  }

  // Calculate next week
  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  let nextWeek = getISOWeekNumber(nextWeekDate);
  let nextWeekYear = nextWeekDate.getFullYear();

  // If we're in week 52/53, next week might be week 1 of next year
  if (currentWeek >= 52 && nextWeek === 1) {
    nextWeekYear = year + 1;
  }

  return {
    lastWeek,
    currentWeek,
    nextWeek,
    year,
  };
}

