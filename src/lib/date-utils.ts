import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInDays,
} from "date-fns";
import { ja } from "date-fns/locale";

export {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInDays,
};

export const jaLocale = ja;

export function getWeekDates(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday start
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDateJP(date: Date): string {
  return format(date, "M/d(E)", { locale: ja });
}

export function formatDateISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDateRange(start: Date, end: Date): string {
  return `${format(start, "yyyy/MM/dd")} ~ ${format(end, "yyyy/MM/dd")}`;
}

export function getDayOfWeekJP(date: Date): string {
  return format(date, "E", { locale: ja });
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** YYYY-MM-DD から本日までの日数差。未来なら正、過去なら負。null/不正は null */
export function daysUntilDate(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}
