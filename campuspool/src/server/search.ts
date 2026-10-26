import { z } from "zod";
import { HttpError } from "@/server/core";
import { pool, rows } from "@/server/db";
import { issueQuote, publicRide } from "@/server/quote";
import type { RideRow, User } from "@/server/types";

export const searchQuery = z.object({
  originStopId: z.coerce.number().int().positive(), destinationStopId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/),
  vehicleKind: z.enum(["CAR", "BIKE", "ALL"]).default("ALL"),
}).strict().superRefine((v, ctx) => {
  const [y, m, d] = v.date.split("-").map(Number);
  const calendar = new Date(Date.UTC(y, m - 1, d));
  if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== m - 1 || calendar.getUTCDate() !== d) ctx.addIssue({ code: "custom", path: ["date"], message: "Invalid calendar date" });
  const time = (s: string) => { const [h, min] = s.split(":").map(Number); return h < 24 && min < 60; };
  if (!time(v.startTime)) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Invalid time" });
  if (!time(v.endTime)) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Invalid time" });
  if (v.originStopId === v.destinationStopId) ctx.addIssue({ code: "custom", path: ["destinationStopId"], message: "Stops must differ" });
  if (v.startTime > v.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must not precede start time" });
});

function kolkataToUtc(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`);
}
function sqlTime(value: Date) { return value.toISOString().slice(0, 19).replace("T", " "); }

export async function searchRides(user: User, input: z.infer<typeof searchQuery>) {
  const start = kolkataToUtc(input.date, input.startTime); const end = kolkataToUtc(input.date, input.endTime);
  const now = new Date();
  const lower = start > now ? start : now;
  if (end < now) return [];
  const kindSql = input.vehicleKind === "ALL" ? "" : " AND v.kind=?";
  const values: unknown[] = [input.originStopId, input.destinationStopId, sqlTime(lower), sqlTime(end), user.id];
  if (input.vehicleKind !== "ALL") values.push(input.vehicleKind);
  const rides = await rows<RideRow>(pool(), `SELECT r.*,u.name AS driver_name,u.status AS driver_status,
    v.kind AS vehicle_kind,v.registration AS vehicle_registration,v.model AS vehicle_model,
    v.passenger_capacity AS vehicle_capacity,v.status AS vehicle_status,o.name AS origin_name,d.name AS destination_name
    FROM rides r JOIN users u ON u.id=r.driver_id JOIN vehicles v ON v.id=r.vehicle_id
    JOIN stops o ON o.id=r.origin_stop_id JOIN stops d ON d.id=r.destination_stop_id
    WHERE r.origin_stop_id=? AND r.destination_stop_id=? AND r.departure_at>=? AND r.departure_at<=?
      AND r.driver_id<>? AND r.status='PUBLISHED' AND r.seats_available>0
      AND u.role='DRIVER' AND u.status='APPROVED' AND v.status='APPROVED'${kindSql}
    ORDER BY r.departure_at ASC`, values);
  return rides.map((ride) => ({ ...publicRide(ride), quoteToken: issueQuote(user.id, ride) }));
}

export async function getRide(user: User, rideId: number) {
  const ride = (await rows<RideRow>(pool(), `SELECT r.*,u.name AS driver_name,u.status AS driver_status,
    v.kind AS vehicle_kind,v.registration AS vehicle_registration,v.model AS vehicle_model,
    v.passenger_capacity AS vehicle_capacity,v.status AS vehicle_status,o.name AS origin_name,d.name AS destination_name
    FROM rides r JOIN users u ON u.id=r.driver_id JOIN vehicles v ON v.id=r.vehicle_id
    JOIN stops o ON o.id=r.origin_stop_id JOIN stops d ON d.id=r.destination_stop_id
    WHERE r.id=? AND r.driver_id<>? AND r.departure_at>UTC_TIMESTAMP(3) AND r.status='PUBLISHED' AND r.seats_available>0
      AND u.role='DRIVER' AND u.status='APPROVED' AND v.status='APPROVED'`, [rideId, user.id]))[0];
  if (!ride) throw new HttpError(404, "RIDE_NOT_FOUND");
  return { ...publicRide(ride), quoteToken: issueQuote(user.id, ride) };
}
