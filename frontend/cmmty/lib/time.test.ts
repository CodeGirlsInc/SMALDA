import { formatRelativeTime } from "./time";

describe("time utilities", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-24T12:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("formats relative time correctly", () => {
    const oneHourAgo = "2026-04-24T11:00:00Z";
    const twoHoursAgo = "2026-04-24T10:00:00Z";
    const justNow = "2026-04-24T11:59:30Z";
    const fiveMinutesAgo = "2026-04-24T11:55:00Z";

    expect(formatRelativeTime(oneHourAgo)).toBe("1h ago");
    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
    expect(formatRelativeTime(justNow)).toBe("just now");
    expect(formatRelativeTime(fiveMinutesAgo)).toBe("5m ago");
  });
});
