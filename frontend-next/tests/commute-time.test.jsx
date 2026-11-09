import { describe, expect, it } from "vitest";
import { initialCommuteSchedule, isFutureCommute, istDateTime } from "../lib/commute-time";

describe("IST commute scheduling", () => {
  const morning = Date.parse("2026-11-09T04:30:00Z"); // 10:00 IST
  const afternoon = Date.parse("2026-11-09T09:30:00Z"); // 15:00 IST
  it("formats the actual calendar day in India regardless of machine timezone", () => {
    expect(istDateTime(new Date(Date.parse("2026-11-09T20:00:00Z")))).toEqual({ date: "2026-11-10", time: "01:30" });
  });
  it("rejects departed or imminent rides, and accepts a future departure", () => {
    expect(isFutureCommute("2026-11-09", "10:00", morning)).toBe(false);
    expect(isFutureCommute("2026-11-09", "10:15", morning)).toBe(false);
    expect(isFutureCommute("2026-11-09", "10:16", morning)).toBe(true);
    expect(isFutureCommute("2026-11-08", "22:00", morning)).toBe(false);
  });
  it("keeps future saved time, but schedules yesterday's commute hour for tomorrow", () => {
    expect(initialCommuteSchedule("11:00", morning)).toEqual({ date: "2026-11-09", time: "11:00" });
    expect(initialCommuteSchedule("10:30", afternoon)).toEqual({ date: "2026-11-10", time: "10:30" });
  });
  it("handles year rollover and invalid server times", () => {
    expect(initialCommuteSchedule("08:00", Date.parse("2026-12-31T15:30:00Z")).date).toBe("2027-01-01");
    expect(initialCommuteSchedule("99:99", morning)).toEqual({ date: "2026-11-09", time: "10:30" });
  });
});
