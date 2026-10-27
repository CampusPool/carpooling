import { afterAll, describe, expect, it } from "vitest";
import { POST as createVehicle } from "@/app/api/vehicles/route";
import { POST as reviewVehicle } from "@/app/api/vehicles/[id]/review/route";
import { vehicleInput } from "@/server/vehicles";
import { pool, exec } from "@/server/db";
import { fixtureUser } from "./support";

const enabled = process.env.RUN_CAMPUSPOOL_INTEGRATION === "1";

describe("issue 12 validation", () => {
  it("enforces BIKE capacity one", () => {
    expect(vehicleInput.safeParse({ kind: "BIKE", registration: "KA01AB1234", model: "Test", passengerCapacity: 2 }).success).toBe(false);
    expect(vehicleInput.safeParse({ kind: "BIKE", registration: "KA01AB1234", model: "Test", passengerCapacity: 1 }).success).toBe(true);
  });
});

describe.skipIf(!enabled)("issue 12 vehicles against real MySQL", () => {
  const created: number[] = [];
  afterAll(async () => {
    if (!created.length) return;
    await exec(pool(), `DELETE FROM vehicles WHERE id IN (${created.map(() => "?").join(",")})`, created);
  });

  it("creates pending vehicles, rejects invalid capacity, and permits admin review", async () => {
    const driver = await fixtureUser("DRIVER");
    const admin = await fixtureUser("ADMIN");
    const invalid = await createVehicle(driver.request("POST", {
      kind: "BIKE", registration: `I12-${Date.now()}`, model: "Test Bike", passengerCapacity: 2,
    }, `i12-invalid-${Date.now()}`));
    expect(invalid.status).toBe(422);

    const key = `i12-create-${Date.now()}`;
    const createdResponse = await createVehicle(driver.request("POST", {
      kind: "CAR", registration: `I12-${Date.now()}`, model: "Test Car", passengerCapacity: 2,
    }, key));
    expect(createdResponse.status).toBe(201);
    const createdBody = await createdResponse.json() as { data: { id: number; status: string } };
    created.push(createdBody.data.id);
    expect(createdBody.data.status).toBe("PENDING");

    const selfReview = await reviewVehicle(driver.request("POST", { status: "APPROVED" }, `i12-self-${Date.now()}`), { params: Promise.resolve({ id: String(createdBody.data.id) }) });
    expect(selfReview.status).toBe(403);
    const review = await reviewVehicle(admin.request("POST", { status: "APPROVED" }, `i12-review-${Date.now()}`), { params: Promise.resolve({ id: String(createdBody.data.id) }) });
    expect(review.status).toBe(200);
    const reviewBody = await review.json() as { data: { status: string } };
    expect(reviewBody.data.status).toBe("APPROVED");
  });
});
