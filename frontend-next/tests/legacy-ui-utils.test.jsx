import { describe, expect, it } from "vitest";
import {
  cash, durationMinutes, instant, list, meters, pickupChoiceLabel,
  pickupWindow, predictionText,
} from "../lib/legacy-ui-utils";

describe("legacy commute view formatting", () => {
  it("preserves the fallbacks for Places (New) prediction text", () => {
    expect(predictionText({ text: { text: "PES University" } })).toBe("PES University");
    expect(predictionText({ mainText: { text: "PES" }, secondaryText: { text: "Bengaluru" } })).toBe("PES, Bengaluru");
    expect(predictionText()).toBe("");
  });

  it("reads legacy API list wrappers without mistaking objects for rows", () => {
    expect(list({ data: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    expect(list([{ id: 2 }])).toEqual([{ id: 2 }]);
    expect(list({ data: null })).toEqual([]);
  });

  it("formats display units and time estimates", () => {
    expect(cash(1500)).toBe("₹15.00");
    expect(meters(125.6)).toBe("126 m");
    expect(meters(Number.NaN)).toBeNull();
    expect(durationMinutes({ ride_seconds: 61 })).toBe(2);
    expect(durationMinutes({ duration_minutes: 5, ride_seconds: 900 })).toBe(5);
    expect(durationMinutes({})).toBeNull();
  });

  it("uses India time for pickup window display", () => {
    expect(instant("not a date")).toBeNull();
    const at = "2026-11-10T03:00:00.000Z";
    expect(instant(at)).toContain("10 Nov");
    expect(pickupWindow({ departure_at: at })).toBe(instant(at));
    expect(pickupWindow({ pickup_window: { earliest: at, latest: "2026-11-10T03:15:00.000Z" } })).toContain("–");
    expect(pickupChoiceLabel("ON_ROUTE_MEETING_POINT")).toBe("Meet along my route");
    expect(pickupChoiceLabel("DIRECT_RIDER_PICKUP")).toBe("Direct pickup");
  });
});
