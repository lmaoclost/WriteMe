import { describe, expect, it } from "vitest";
import { dateIsEmpty, dateKey, formatDate, formatDateWithCalendar, isValidDate, sanitizeDate } from "./dates";

describe("sanitizeDate", () => {
  it("accepts the three formats and returns the input unchanged", () => {
    expect(sanitizeDate("1200")).toBe("1200");
    expect(sanitizeDate("1200-05")).toBe("1200-05");
    expect(sanitizeDate("1200-05-10")).toBe("1200-05-10");
  });

  it("accepts negative years with the minus prefix", () => {
    expect(sanitizeDate("-1200")).toBe("-1200");
    expect(sanitizeDate("-1200-05")).toBe("-1200-05");
    expect(sanitizeDate("-1200-05-10")).toBe("-1200-05-10");
  });

  it("rejects out-of-range months and days", () => {
    expect(sanitizeDate("1200-13")).toBeNull();
    expect(sanitizeDate("1200-00")).toBeNull();
    expect(sanitizeDate("1200-05-32")).toBeNull();
    expect(sanitizeDate("1200-05-00")).toBeNull();
  });

  it("rejects garbage, empty, overlong years and stray separators", () => {
    expect(sanitizeDate("abc")).toBeNull();
    expect(sanitizeDate("")).toBeNull();
    expect(sanitizeDate("12000")).toBeNull();
    expect(sanitizeDate("1200.05")).toBeNull();
    expect(sanitizeDate("1200-05-10-3")).toBeNull();
    expect(sanitizeDate("12--05")).toBeNull();
  });

  it("accepts single-digit month and day (regex allows 1-2 digits)", () => {
    expect(sanitizeDate("1200-5")).toBe("1200-5");
    expect(sanitizeDate("1200-5-3")).toBe("1200-5-3");
  });
});

describe("dateKey", () => {
  it("fills month and day with 1 for shorter formats", () => {
    expect(dateKey("1200")).toBe(1200 * 10000 + 1 * 100 + 1);
    expect(dateKey("1200-05")).toBe(1200 * 10000 + 5 * 100 + 1);
    expect(dateKey("1200-05-10")).toBe(1200 * 10000 + 5 * 100 + 10);
  });

  it("sorts negative years by arithmetic", () => {
    expect(dateKey("-1200")).toBe(-1200 * 10000 + 1 * 100 + 1);
    // Pure arithmetics keeps chronological order inside a BC year:
    // January (fill 1) sorts before May 10th.
    expect(dateKey("-1200")).toBeLessThan(dateKey("-1200-05-10"));
    // And earlier BC years sort first.
    expect(dateKey("-1300")).toBeLessThan(dateKey("-1200"));
    expect(dateKey("-1200")).toBeLessThan(dateKey("1200"));
  });
});

describe("formatDate", () => {
  it("renders year, month and full-day formats in PT", () => {
    expect(formatDate("1200")).toBe("1200");
    expect(formatDate("1200-05")).toBe("1200 · Maio");
    expect(formatDate("1200-05-05")).toBe("5 de Maio de 1200");
  });

  it("covers the month range and negative years", () => {
    expect(formatDate("1200-01")).toBe("1200 · Janeiro");
    expect(formatDate("1200-12")).toBe("1200 · Dezembro");
    expect(formatDate("-1200-05")).toBe("-1200 · Maio");
  });
});

describe("helpers", () => {
  it("isValidDate mirrors sanitizeDate", () => {
    expect(isValidDate("1200-05")).toBe(true);
    expect(isValidDate("1200-13")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });

  it("dateIsEmpty checks a bare empty string", () => {
    expect(dateIsEmpty("")).toBe(true);
    expect(dateIsEmpty("1200")).toBe(false);
  });
});

describe("formatDateWithCalendar", () => {
  const cal = {
    months: [{ name: "Calor" }, { name: "Sela" }, { name: "Cera" }, { name: "Fala" }, { name: "Vela" }],
    era: "Contagem do Arco",
  };
  it("full date renders day + calendar month name + year + era", () => {
    expect(formatDateWithCalendar("1200-05-10", cal)).toBe("10 Vela 1200 · Contagem do Arco");
  });
  it("partial date renders month name + year + era", () => {
    expect(formatDateWithCalendar("1200-05", cal)).toBe("Vela 1200 · Contagem do Arco");
  });
  it("year-only renders year + era", () => {
    expect(formatDateWithCalendar("1200", cal)).toBe("1200 · Contagem do Arco");
  });
  it("no era drops the suffix", () => {
    expect(formatDateWithCalendar("1200-05", { months: cal.months })).toBe("Vela 1200");
  });
  it("no calendar falls back to the Gregorian format", () => {
    expect(formatDateWithCalendar("1200-05-10")).toBe("10 de Maio de 1200");
  });
  it("month index wraps modulo the calendar month count", () => {
    expect(formatDateWithCalendar("1200-07", cal)).toBe("Sela 1200 · Contagem do Arco");
  });
  it("negative years keep the - sign with calendar rendering", () => {
    expect(formatDateWithCalendar("-5-03", cal)).toBe("Cera -5 · Contagem do Arco");
  });
});
