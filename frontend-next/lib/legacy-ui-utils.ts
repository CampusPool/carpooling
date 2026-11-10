/* Pure formatting helpers for the legacy/student commute experience. */

export type R = Record<string, any>;
// Places (New) returns FormattableText objects. Prefer their text field for stable labels.
export const placeText = (value: any): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value?.text === "string") return value.text.trim();
  if (typeof value?.toString === "function") {
    const converted = value.toString();
    if (typeof converted === "string" && converted !== "[object Object]") return converted.trim();
  }
  return "";
};
export const predictionText = (prediction: R | undefined): string => {
  if (!prediction) return "";
  const full = placeText(prediction.text) || placeText(prediction.description);
  const main = placeText(prediction.mainText);
  const secondary = placeText(prediction.secondaryText);
  return full || [main, secondary].filter(Boolean).join(", ");
};
export const list = (x: any) =>
  Array.isArray(x?.data) ? x.data : Array.isArray(x) ? x : [];
export const tomorrowInKolkata = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 864e5));
export const cash = (x: any) => `₹${(Number(x || 0) / 100).toFixed(2)}`;
export const meters = (x: any) =>
  typeof x === "number" && Number.isFinite(x) ? `${Math.round(x)} m` : null;
export const durationMinutes = (ride: R) => {
  if (typeof ride.duration_minutes === "number") return ride.duration_minutes;
  if (typeof ride.ride_seconds === "number" && ride.ride_seconds >= 0) {
    return Math.ceil(ride.ride_seconds / 60);
  }
  return null;
};
export const instant = (x: any) =>
  typeof x === "string" && x && Number.isFinite(Date.parse(x))
    ? new Date(x).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
export const pickupWindow = (ride: R) => {
  const earliest = instant(ride.pickup_window?.earliest);
  const latest = instant(ride.pickup_window?.latest);
  if (earliest && latest) return `${earliest} – ${latest}`;
  return instant(ride.departure_at);
};
export const pickupChoiceLabel = (choice: string) =>
  choice === "ON_ROUTE_MEETING_POINT" ? "Meet along my route" : "Direct pickup";
