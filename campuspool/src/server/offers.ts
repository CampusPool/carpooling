import { z } from "zod";
import { emit, HttpError, idempotent } from "@/server/core";
import { exec, pool, rows } from "@/server/db";
import { issueQuote, publicRide } from "@/server/quote";
import type { RideRow, User } from "@/server/types";

export const offerInput = z.object({
  vehicleId: z.number().int().positive(), originStopId: z.number().int().positive(),
  destinationStopId: z.number().int().positive(),
  departureAt: z.string().datetime({ offset: true }),
  totalSeats: z.number().int().min(1).max(5), creditPrice: z.number().int().min(1).max(1000),
}).strict().superRefine((v, ctx) => {
  if (v.originStopId === v.destinationStopId) ctx.addIssue({ code: "custom", path: ["destinationStopId"], message: "Stops must differ" });
});

function sqlTime(value: Date) { return value.toISOString().slice(0, 19).replace("T", " "); }
function validWindow(value: string) {
  const when = new Date(value); const now = Date.now();
  if (Number.isNaN(when.valueOf())) throw new HttpError(400, "INVALID_DEPARTURE");
  if (when.valueOf() < now + 15 * 60_000 || when.valueOf() > now + 30 * 86_400_000) throw new HttpError(422, "DEPARTURE_WINDOW");
  return when;
}

export async function listOffers(user: User) {
  if (user.role !== "DRIVER") throw new HttpError(403, "DRIVER_REQUIRED");
  const rides = await rows<RideRow>(pool(), `SELECT r.*,u.name AS driver_name,u.status AS driver_status,
    v.kind AS vehicle_kind,v.status AS vehicle_status,
    v.registration AS vehicle_registration, v.model AS vehicle_model, v.passenger_capacity AS vehicle_capacity,
    o.name AS origin_name, d.name AS destination_name FROM rides r JOIN users u ON u.id=r.driver_id
    JOIN vehicles v ON v.id=r.vehicle_id
    JOIN stops o ON o.id=r.origin_stop_id JOIN stops d ON d.id=r.destination_stop_id
    WHERE r.driver_id=? ORDER BY r.departure_at DESC`, [user.id]);
  return rides.map((ride) => publicRide(ride));
}

export async function publishOffer(user: User, input: z.infer<typeof offerInput>, key: string) {
  if (user.role !== "DRIVER" || user.status !== "APPROVED") throw new HttpError(403, "APPROVED_DRIVER_REQUIRED");
  const departure = validWindow(input.departureAt);
  return idempotent(user.id, key, "offer.publish", input, async (cx) => {
    const driver = await rows<{ id: number; role: string; status: string }>(cx, "SELECT id,role,status FROM users WHERE id=? FOR UPDATE", [user.id]);
    if (!driver[0] || driver[0].role !== "DRIVER" || driver[0].status !== "APPROVED") throw new HttpError(403, "APPROVED_DRIVER_REQUIRED");
    const vehicle = await rows<{ id: number; owner_id: number; kind: "CAR"|"BIKE"; passenger_capacity: number; status: string }>(cx,
      "SELECT id,owner_id,kind,passenger_capacity,status FROM vehicles WHERE id=? FOR UPDATE", [input.vehicleId]);
    if (!vehicle[0]) throw new HttpError(404, "VEHICLE_NOT_FOUND");
    if (vehicle[0].owner_id !== user.id || vehicle[0].status !== "APPROVED") throw new HttpError(403, "VEHICLE_NOT_APPROVED");
    if (input.totalSeats > vehicle[0].passenger_capacity) throw new HttpError(422, "SEAT_CAPACITY_EXCEEDED");
    const overlap = await rows<{ id: number }>(cx, `SELECT id FROM rides WHERE driver_id=? AND status='PUBLISHED'
      AND departure_at BETWEEN DATE_SUB(?, INTERVAL 60 MINUTE) AND DATE_ADD(?, INTERVAL 60 MINUTE) FOR UPDATE`,
      [user.id, sqlTime(departure), sqlTime(departure)]);
    if (overlap.length) throw new HttpError(409, "DRIVER_TIME_CONFLICT");
    const result = await exec(cx, `INSERT INTO rides
      (driver_id,vehicle_id,origin_stop_id,destination_stop_id,departure_at,total_seats,seats_available,credit_price,status)
      VALUES (?,?,?,?,?,?,?,?,'PUBLISHED')`, [user.id, input.vehicleId, input.originStopId, input.destinationStopId,
      sqlTime(departure), input.totalSeats, input.totalSeats, input.creditPrice]);
    const ride = (await rows<RideRow>(cx, `SELECT r.*,u.name AS driver_name,u.status AS driver_status,
      v.kind AS vehicle_kind,v.status AS vehicle_status,v.registration AS vehicle_registration,
      v.model AS vehicle_model,v.passenger_capacity AS vehicle_capacity,o.name AS origin_name,d.name AS destination_name
      FROM rides r JOIN users u ON u.id=r.driver_id JOIN vehicles v ON v.id=r.vehicle_id
      JOIN stops o ON o.id=r.origin_stop_id JOIN stops d ON d.id=r.destination_stop_id WHERE r.id=?`, [result.insertId]))[0];
    await emit(cx, { type: "ride.published", actorId: user.id, audienceIds: [], rideId: ride.id, data: { vehicleId: input.vehicleId } });
    return { ...publicRide(ride), quoteToken: issueQuote(user.id, ride) };
  });
}
