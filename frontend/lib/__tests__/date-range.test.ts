import { endOfDayISO, startOfDayISO } from "../date-range";

describe("date-range", () => {
  it("covers the whole local day", () => {
    const start = new Date(startOfDayISO("2026-11-18"));
    const end = new Date(endOfDayISO("2026-11-18"));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("starts at local midnight and ends at 23:59:59.999 local time", () => {
    const start = new Date(startOfDayISO("2026-11-18"));
    const end = new Date(endOfDayISO("2026-11-18"));
    expect([start.getHours(), start.getMinutes(), start.getDate()]).toEqual([0, 0, 18]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getDate()]).toEqual([23, 59, 59, 18]);
  });
});
