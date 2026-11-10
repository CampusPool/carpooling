import { describe, expect, it } from "vitest";
import { formatOtpCountdown, normalizeStudentEmail } from "../../lib/student-email";
describe("PES student email guidance", () => {
  it("normalizes exact student domain", () => {
    expect(normalizeStudentEmail(" Student@STU.PES.EDU ")).toBe("student@stu.pes.edu");
  });
  it.each([
    "student@gmail.com", "student@evil-stu.pes.edu", "student@stu.pes.edu.evil",
    "student+alias@stu.pes.edu", "student＠stu.pes.edu", "student @stu.pes.edu",
    "student@stu.pes.edu\nattacker@example.com", "a..b@stu.pes.edu",
  ])("rejects %s", (email) => {
    expect(normalizeStudentEmail(email)).toBeNull();
  });
  it("formats five-minute and one-minute clocks", () => {
    expect(formatOtpCountdown(300)).toBe("5:00");
    expect(formatOtpCountdown(60)).toBe("1:00");
    expect(formatOtpCountdown(0)).toBe("0:00");
  });
});
