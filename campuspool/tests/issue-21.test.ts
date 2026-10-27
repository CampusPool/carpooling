import { afterAll, describe, expect, it } from "vitest";
import { POST as publishOffer } from "@/app/api/offers/route";
import { offerInput } from "@/server/offers";
import { exec, pool, rows } from "@/server/db";
import { fixtureUser } from "./support";

const enabled = process.env.RUN_CAMPUSPOOL_INTEGRATION === "1";

describe("issue 21 validation", () => {
  it("requires integer synthetic credits from 1 through 1000", () => {
    const base = { vehicleId: 1, originStopId: 1, destinationStopId: 2, departureAt: "2030-01-01T10:00:00+05:30", totalSeats: 1 };
    expect(offerInput.safeParse({ ...base, creditPrice: 0 }).success).toBe(false);
    expect(offerInput.safeParse({ ...base, creditPrice: 10 }).success).toBe(true);
  });
});

describe.skipIf(!enabled)("issue 21 offers against real MySQL", () => {
  const rideIds: number[] = [];
  const vehicleIds: number[] = [];
  afterAll(async () => {
    if (rideIds.length) await exec(pool(), `DELETE FROM rides WHERE id IN (${rideIds.map(() => "?").join(",")})`, rideIds);
    if (vehicleIds.length) await exec(pool(), `DELETE FROM vehicles WHERE id IN (${vehicleIds.map(() => "?").join(",")})`, vehicleIds);
  });

  it("publishes an approved-driver offer and rejects a 60-minute overlap", async () => {
    const driver = await fixtureUser("DRIVER");
    const stops = await rows<{ id: number }>(pool(), "SELECT id FROM stops ORDER BY id LIMIT 2");
    expect(stops).toHaveLength(2);
    const registration = `I21-${Date.now()}`;
    const vehicle = await exec(pool(), `INSERT INTO vehicles(owner_id,kind,registration,model,passenger_capacity,status)
      VALUES(?,?,?,?,?,'APPROVED')`, [driver.user.id, "CAR", registration, "Integration Car", 2]);
    vehicleIds.push(vehicle.insertId);
    const departure = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const payload = { vehicleId: vehicle.insertId, originStopId: stops[0].id, destinationStopId: stops[1].id,
      departureAt: departure, totalSeats: 2, creditPrice: 10 };
    const first = await publishOffer(driver.request("POST", payload, `i21-first-${Date.now()}`));
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { data: { id: number; seatsAvailable: number } };
    rideIds.push(firstBody.data.id);
    expect(firstBody.data.seatsAvailable).toBe(2);
    const overlap = await publishOffer(driver.request("POST", { ...payload,
      departureAt: new Date(Date.now() + 2 * 60 * 60_000 + 30 * 60_000).toISOString() }, `i21-overlap-${Date.now()}`));
    expect(overlap.status).toBe(409);
  });
});
