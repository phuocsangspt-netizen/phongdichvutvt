/**
 * Time & date utilities for workshop schedule slot locking and live clock tracking.
 * Always uses the user's local timezone to avoid UTC off-by-one-day bugs.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return getLocalDateString();
  const next = new Date(y, m - 1, d + days);
  return getLocalDateString(next);
}

export function getCurrentTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function isPastDate(dateStr: string, now: Date = new Date()): boolean {
  return dateStr < getLocalDateString(now);
}

/**
 * Returns true if the given (YYYY-MM-DD, HH:mm) slot is in the past relative to `now`.
 * - Any date strictly before today is locked.
 * - On today's date, any slot whose start time is strictly before the current local minute is locked.
 * - Future dates are unlocked.
 */
export function isSlotInPast(
  dateStr: string,
  timeSlot: string,
  now: Date = new Date()
): boolean {
  const todayStr = getLocalDateString(now);
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = timeToMinutes(timeSlot);
  return slotMinutes < nowMinutes;
}

/**
 * Finds the next available (non-past) date and time slot starting from `preferredDate`.
 */
export function getNextAvailableSlot(
  preferredDate: string,
  allSlots: string[],
  now: Date = new Date()
): { date: string; timeSlot: string } {
  const todayStr = getLocalDateString(now);
  const candidateDate = preferredDate < todayStr ? todayStr : preferredDate;

  const openSlot = allSlots.find((slot) => !isSlotInPast(candidateDate, slot, now));
  if (openSlot) {
    return { date: candidateDate, timeSlot: openSlot };
  }

  // All slots on candidateDate have passed -> advance to next day first slot
  const tomorrowStr = addDaysToDateString(candidateDate, 1);
  return { date: tomorrowStr, timeSlot: allSlots[0] || '08:00' };
}

/**
 * Calculates the exact horizontal percentage (0–100) for the live vertical time line
 * within a shift window (e.g. '08:00' to '11:30' or '13:00' to '16:30').
 * Returns null if `now` is outside that shift window.
 */
export function getShiftLiveLinePercent(
  now: Date,
  shiftStart: string,
  shiftEnd: string
): number | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(shiftStart);
  const endMinutes = timeToMinutes(shiftEnd);

  if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
    return null;
  }

  return ((nowMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
}
