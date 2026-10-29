import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DriverOnboarding from "../components/DriverOnboarding";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("driver onboarding client", () => {
  it("creates an owned vehicle and starts its application through the real API contracts", async () => {
    const calls = [];
    let vehicles = [];
    let applications = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET";
      calls.push({ url, method, body: init.body });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: applications });
      if (url === "/api/cars" && method === "GET") return json({ data: vehicles });
      if (url === "/api/car-colors") return json({ data: [{ id: 3, name: "Blue" }] });
      if (url === "/api/cars" && method === "POST") {
        const payload = JSON.parse(init.body);
        expect(payload).toMatchObject({ patente: "KA01AB1234", brand_other: "Honda", model_other: "City", car_color_id: "3", year: "2024" });
        vehicles = [{ id: 17, brand_other: "Honda", model_other: "City", patente: "KA01AB1234", year: 2024 }];
        return json({ id: 17 }, 201);
      }
      if (url === "/api/mobility/driver-onboarding" && method === "POST") {
        const payload = JSON.parse(init.body);
        expect(payload).toMatchObject({ car_id: "17", vehicle_type: "car", legal_passenger_capacity: "4", profile_display_name: "A Driver", profile_phone: "9876543210" });
        applications = [{ id: 44, status: "pending", version: 1, profile_display_name: "A Driver", vehicle_type: "car", legal_passenger_capacity: 4, vehicle: { brand: "Honda", model: "City" }, checklist: [{ document_type: "driver_license", required: true, status: "missing" }] }];
        return json({ onboarding_id: 44, status: "pending", version: 1 }, 201);
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<DriverOnboarding token="session-token" />);
    await screen.findByText(/No vehicle is available yet/);
    fireEvent.click(screen.getByText("Add a vehicle"));
    fireEvent.change(screen.getByLabelText("Registration number"), { target: { value: "KA01AB1234" } });
    fireEvent.change(screen.getByLabelText("Make"), { target: { value: "Honda" } });
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "City" } });
    fireEvent.change(screen.getByLabelText("Colour"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2024" } });
    fireEvent.click(screen.getByRole("button", { name: "Save owned vehicle" }));
    await screen.findByText(/Honda City/);

    fireEvent.change(screen.getByLabelText("Owned vehicle"), { target: { value: "17" } });
    fireEvent.change(screen.getByLabelText(/^Legal passenger seats/), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Driver display name"), { target: { value: "A Driver" } });
    fireEvent.change(screen.getByLabelText("Phone (optional)"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: "Start application" }));
    await screen.findByText("Waiting for manual review");
    expect(screen.getByText("Driver licence")).toBeInTheDocument();
    expect(calls.some(({ url, method }) => url === "/api/mobility/driver-onboarding" && method === "POST")).toBe(true);
  });

  it("sends legacy approved applications missing capacity back for operator review", async () => {
    const calls = [];
    let application = { id: 8, status: "approved", version: 5, legal_passenger_capacity: null, profile_display_name: "Legacy Driver", profile_phone: null, vehicle_type: "car", vehicle: { brand: "Honda", model: "City" }, checklist: [{ document_type: "rc", required: true, status: "accepted", expires_at: "2027-10-29" }] };
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET"; calls.push({ url, method, body: init.body });
      if (url === "/api/mobility/driver-onboarding/me") return json({ data: [application] });
      if (url === "/api/cars") return json({ data: [] });
      if (url === "/api/car-colors") return json({ data: [] });
      if (url === "/api/mobility/driver-onboarding/8/profile" && method === "PUT") {
        const body = JSON.parse(init.body);
        expect(body).toMatchObject({ legal_passenger_capacity: "3", expected_version: 5 });
        application = { ...application, legal_passenger_capacity: 3, status: "needs_resubmission", version: 6 };
        return json({ onboarding_id: 8, legal_passenger_capacity: 3, version: 6 });
      }
      if (url === "/api/mobility/driver-onboarding/8/submit" && method === "POST") {
        application = { ...application, status: "pending", version: 7 };
        return json({ onboarding_id: 8, status: "pending", version: 7 });
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<DriverOnboarding token="session-token" />);
    await screen.findByText(/This older approval has no reviewed passenger capacity/);
    fireEvent.change(screen.getAllByLabelText(/^Legal passenger seats/)[1], { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Correction requested");
    fireEvent.click(screen.getByRole("button", { name: "Submit checklist for review" }));
    await screen.findByText("Waiting for manual review");
    expect(calls.some(({ url, method }) => url === "/api/mobility/driver-onboarding/8/submit" && method === "POST")).toBe(true);
  });
});
