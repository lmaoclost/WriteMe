const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DATE_RE = /^-?\d{1,4}(-\d{1,2}){0,2}$/;

/** "1200" | "1200-05" | "1200-05-10" (negative era prefix allowed) or null. */
export function sanitizeDate(input: string): string | null {
  if (!DATE_RE.test(input)) return null;
  const body = input.startsWith("-") ? input.slice(1) : input;
  const parts = body.split("-").map(Number);
  if (parts[1] !== undefined && (parts[1] < 1 || parts[1] > 12)) return null;
  if (parts[2] !== undefined && (parts[2] < 1 || parts[2] > 31)) return null;
  return input;
}

export function isValidDate(input: string): boolean {
  return sanitizeDate(input) !== null;
}

export function dateIsEmpty(date: string): boolean {
  return !date || !date.length;
}

/** Ano*10000 + mês*100 + dia, month/day filled with 1; negative years work by
 *  arithmetic. Callers never pass an empty/null date (sort those aside first). */
export function dateKey(date: string): number {
  const sign = date.startsWith("-") ? -1 : 1;
  const parts = (date.startsWith("-") ? date.slice(1) : date).split("-").map(Number);
  const year = sign * (parts[0] ?? 0);
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return year * 10000 + month * 100 + day;
}

/** "1200" / "1200 · Maio" / "5 de Maio de 1200" — expects a sanitized date. */
export function formatDate(date: string): string {
  const negative = date.startsWith("-");
  const parts = (negative ? date.slice(1) : date).split("-").map((p) => String(Number(p)));
  const year = negative ? `-${parts[0]}` : parts[0];
  if (parts.length === 1) return year;
  const month = MONTHS[Number(parts[1]) - 1];
  if (parts.length === 2) return `${year} · ${month}`;
  return `${Number(parts[2])} de ${month} de ${year}`;
}

export interface CalendarDateFormat {
  months: { name: string }[];
  era?: string;
}

/** Like formatDate, but the month/day render through the project's custom
 *  calendar: month name by index position, era appended after the year
 *  ("10 Vela 1200 · Contagem do Arco"). Without a calendar it defers to the
 *  Gregorian format. Expects a sanitized date. */
export function formatDateWithCalendar(date: string, cal?: CalendarDateFormat): string {
  if (!cal) return formatDate(date);
  const negative = date.startsWith("-");
  const parts = (negative ? date.slice(1) : date).split("-").map((p) => String(Number(p)));
  const year = negative ? `-${parts[0]}` : parts[0];
  const era = cal.era ? ` · ${cal.era}` : "";
  if (parts.length === 1) return `${year}${era}`;
  const monthName = cal.months[(Number(parts[1]) - 1) % cal.months.length]?.name ?? "Mês";
  if (parts.length === 2) return `${monthName} ${year}${era}`;
  return `${Number(parts[2])} ${monthName} ${year}${era}`;
}
