import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DriverOnboarding from "../components/DriverOnboarding";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("simplified driver setup client", () => {
  it("loads existing driver setup and displays approved vehicle and license details", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url === "/api/mobility/driver-setup") {
        return json({
          setup_complete: true,
          vehicle_number: "KA01AB1234",
          vehicle_type: "car",
          seats_available: 3,
          license_number: "DL1420110012345",
          status: "approved",
        });
      }
      throw new Error(`Unhandled request ${url}`);
    }));

    render(<DriverOnboarding token="session-token" />);
    await screen.findByRole("heading", { name: "Vehicle and license setup" });
    expect(await screen.findByText(/Approved to drive and publish rides/)).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle number")).toHaveValue("KA01AB1234");
    expect(screen.getByLabelText("Type (car/bike)")).toHaveValue("car");
    expect(screen.getByLabelText("Number of seats available for pooling")).toHaveValue(3);
    expect(screen.getByLabelText("License number")).toHaveValue("DL1420110012345");
  });

  it("submits vehicle number, type, seats, and license number and automatically approves", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      const url = String(input); const method = init.method || "GET";
      calls.push({ url, method, body: init.body });
      if (url === "/api/mobility/driver-setup" && method === "GET") {
        return json({ setup_complete: false, vehicle_number: "", vehicle_type: "car", seats_available: 3, license_number: "", status: "pending" });
      }
      if (url === "/api/mobility/driver-setup" && method === "POST") {
        const payload = JSON.parse(init.body);
        expect(payload).toEqual({
          vehicle_number: "KA-05-NB-5555",
          vehicle_type: "car",
          seats_available: 4,
          license_number: "KA0520210009999",
        });
        return json({
          setup_complete: true,
          vehicle_number: "KA05NB5555",
          vehicle_type: "car",
          seats_available: 4,
          license_number: "KA0520210009999",
          status: "approved",
          message: "Driver setup complete. Vehicle and driver license automatically accepted.",
        }, 200);
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    }));

    render(<DriverOnboarding token="session-token" />);
    await screen.findByRole("heading", { name: "Vehicle and license setup" });

    fireEvent.change(screen.getByLabelText("Vehicle number"), { target: { value: "KA-05-NB-5555" } });
    fireEvent.change(screen.getByLabelText("Type (car/bike)"), { target: { value: "car" } });
    fireEvent.change(screen.getByLabelText("Number of seats available for pooling"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("License number"), { target: { value: "KA0520210009999" } });

    fireEvent.click(screen.getByRole("button", { name: "Save driver setup" }));

    await screen.findByText(/Driver setup complete. Vehicle and driver license automatically accepted./);
    expect(await screen.findByText(/Approved to drive and publish rides/)).toBeInTheDocument();
    expect(calls.some(c => c.url === "/api/mobility/driver-setup" && c.method === "POST")).toBe(true);
  });

  it("limits motorbike passenger capacity to 1", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url === "/api/mobility/driver-setup") {
        return json({ setup_complete: false, vehicle_number: "", vehicle_type: "car", seats_available: 3, license_number: "", status: "pending" });
      }
      throw new Error(`Unhandled request ${url}`);
    }));

    render(<DriverOnboarding token="session-token" />);
    await screen.findByRole("heading", { name: "Vehicle and license setup" });

    fireEvent.change(screen.getByLabelText("Type (car/bike)"), { target: { value: "bike" } });
    expect(screen.getByLabelText("Number of seats available for pooling")).toHaveValue(1);
    expect(screen.getByLabelText("Number of seats available for pooling")).toBeDisabled();
    expect(screen.getByText(/Motorbikes allow 1 pooling passenger seat./)).toBeInTheDocument();
  });
});
