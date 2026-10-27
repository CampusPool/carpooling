import { z } from "zod";
import { emit, HttpError, idempotent } from "@/server/core";
import { exec, pool, rows } from "@/server/db";
import type { User, VehicleRow } from "@/server/types";

export const vehicleInput = z.object({
  kind: z.enum(["CAR", "BIKE"]),
  registration: z.string().trim().min(2).max(32),
  model: z.string().trim().min(1).max(100),
  passengerCapacity: z.number().int().min(1).max(5),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "BIKE" && value.passengerCapacity !== 1) {
    ctx.addIssue({ code: "custom", path: ["passengerCapacity"], message: "Bikes have capacity 1" });
  }
});

export const reviewInput = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
}).strict();

function dto(v: VehicleRow & { owner_name?: string | null; review_note?: string | null }) {
  return { id: v.id, ownerId: v.owner_id, ownerName: v.owner_name, kind: v.kind,
    registration: v.registration, model: v.model, passengerCapacity: v.passenger_capacity,
    status: v.status, reviewNote: v.review_note };
}

export async function listVehicles(user: User) {
  const predicate = user.role === "ADMIN" ? "" : "WHERE v.owner_id = ?";
  const values = user.role === "ADMIN" ? [] : [user.id];
  const data = await rows<VehicleRow & { owner_name?: string; review_note?: string }>(
    pool(),
    `SELECT v.*, u.name AS owner_name FROM vehicles v JOIN users u ON u.id=v.owner_id ${predicate} ORDER BY v.created_at DESC`,
    values,
  );
  return data.map(dto);
}

export async function createVehicle(user: User, input: z.infer<typeof vehicleInput>, key: string) {
  if (user.role !== "DRIVER") throw new HttpError(403, "DRIVER_REQUIRED", "Only drivers can add vehicles");
  if (user.status !== "APPROVED") throw new HttpError(403, "MEMBER_NOT_APPROVED");
  return idempotent(user.id, key, "vehicle.create", input, async (cx) => {
    const result = await exec(cx, `INSERT INTO vehicles
      (owner_id,kind,registration,model,passenger_capacity,status) VALUES (?,?,?,?,?,'PENDING')`,
      [user.id, input.kind, input.registration, input.model, input.passengerCapacity]);
    const created = await rows<VehicleRow>(cx, "SELECT * FROM vehicles WHERE id=?", [result.insertId]);
    return dto(created[0]);
  });
}

export async function reviewVehicle(admin: User, vehicleId: number, input: z.infer<typeof reviewInput>, key: string) {
  if (admin.role !== "ADMIN" || admin.status !== "APPROVED") throw new HttpError(403, "ADMIN_REQUIRED");
  return idempotent(admin.id, key, "vehicle.review", { vehicleId, ...input }, async (cx) => {
    const current = await rows<VehicleRow>(cx, "SELECT * FROM vehicles WHERE id=? FOR UPDATE", [vehicleId]);
    if (!current[0]) throw new HttpError(404, "VEHICLE_NOT_FOUND");
    await exec(cx, "UPDATE vehicles SET status=?, reviewed_by=?, review_note=? WHERE id=?",
      [input.status, admin.id, input.note ?? null, vehicleId]);
    await emit(cx, { type: "vehicle.reviewed", actorId: admin.id, audienceIds: [current[0].owner_id],
      data: { vehicleId, status: input.status } });
    const updated = await rows<VehicleRow>(cx, "SELECT * FROM vehicles WHERE id=?", [vehicleId]);
    return dto(updated[0]);
  });
}
