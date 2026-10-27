export type BookingLike = Record<string, any>;
export function driverAction(
  b: BookingLike,
): "start" | "board" | "alight" | "complete" | null {
  if (!b.owner || Number(b.request_state) !== 1 || b.wallet_state !== "held")
    return null;
  if (b.state === "planned") return "start";
  if (b.state !== "in_progress") return null;
  if (b.participant_state === "accepted") return "board";
  if (b.participant_state === "boarded") return "alight";
  if (b.participant_state === "alighted") return "complete";
  return null;
}
