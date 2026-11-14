"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { emitUnauthorized } from "../lib/session-events";

type Json = Record<string, any>;

async function call(path: string, token: string, method = "GET", body?: Json) {
  const response = await fetch(path.startsWith("/api/") ? path : `/api/${path}`, {
    method,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) emitUnauthorized(token);
    const code = data?.error?.code;
    const detail = data?.message || data?.error?.message || code || `Request failed (${response.status})`;
    throw new Error(String(detail));
  }
  return data;
}

export default function DriverOnboarding({ token }: { token: string }) {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<"car" | "bike">("car");
  const [seatsAvailable, setSeatsAvailable] = useState<number>(3);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [setupComplete, setSetupComplete] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await call("mobility/driver-setup", token);
      if (data) {
        if (data.vehicle_number) setVehicleNumber(data.vehicle_number);
        if (data.vehicle_type) setVehicleType(data.vehicle_type);
        if (data.seats_available) setSeatsAvailable(Number(data.seats_available));
        if (data.license_number) setLicenseNumber(data.license_number);
        setSetupComplete(Boolean(data.setup_complete));
        setStatus(data.status || "pending");
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Could not load driver setup.");
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await call("mobility/driver-setup", token, "POST", {
        vehicle_number: vehicleNumber.trim(),
        vehicle_type: vehicleType,
        seats_available: vehicleType === "bike" ? 1 : Number(seatsAvailable),
        license_number: licenseNumber.trim(),
      });
      setSetupComplete(true);
      setStatus(result.status || "approved");
      setNotice("Driver setup complete. Vehicle and driver license automatically accepted.");
      if (result.vehicle_number) setVehicleNumber(result.vehicle_number);
      if (result.license_number) setLicenseNumber(result.license_number);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Could not save driver setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding-page" aria-labelledby="onboarding-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">DRIVER SETUP</p>
          <h3 id="onboarding-title">Vehicle and license setup</h3>
        </div>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={busy}>Refresh</button>
      </div>

      <p className="fine">
        Enter your vehicle and driving license details below. Your license is automatically verified and accepted so you can immediately publish rides.
      </p>

      {error && <p className="error banner" role="alert">{error}</p>}
      {notice && <p className="banner" role="status">{notice}</p>}

      {setupComplete && status === "approved" && (
        <div className="banner" style={{ background: "#e7f5eb", color: "#176b5b", borderColor: "#a3d9b8" }}>
          <strong>✓ Approved to drive and publish rides</strong>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
            Vehicle {vehicleNumber} ({vehicleType === "bike" ? "Bike" : "Car"}) · {seatsAvailable} pooling seat{seatsAvailable === 1 ? "" : "s"} · License {licenseNumber} automatically accepted.
          </p>
        </div>
      )}

      <section className="onboarding-panel">
        <h4>Driver details</h4>
        <form className="form-grid onboarding-form" onSubmit={submit}>
          <label>
            Vehicle number
            <input
              name="vehicle_number"
              aria-label="Vehicle number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. KA-01-AB-1234"
              maxLength={20}
              autoComplete="off"
              required
              disabled={busy}
            />
          </label>

          <label>
            Type (car/bike)
            <select
              name="vehicle_type"
              aria-label="Type (car/bike)"
              value={vehicleType}
              onChange={(e) => {
                const type = e.target.value as "car" | "bike";
                setVehicleType(type);
                if (type === "bike") setSeatsAvailable(1);
              }}
              disabled={busy}
            >
              <option value="car">Car</option>
              <option value="bike">Bike</option>
            </select>
          </label>

          <label>
            Number of seats available for pooling
            <input
              name="seats_available"
              aria-label="Number of seats available for pooling"
              type="number"
              min={1}
              max={vehicleType === "bike" ? 1 : 6}
              value={seatsAvailable}
              onChange={(e) => setSeatsAvailable(Math.max(1, Number(e.target.value)))}
              required
              disabled={busy || vehicleType === "bike"}
            />
            <span className="fine">
              {vehicleType === "bike"
                ? "Motorbikes allow 1 pooling passenger seat."
                : "Seats available for pooling passengers (excluding driver)."}
            </span>
          </label>

          <label>
            License number
            <input
              name="license_number"
              aria-label="License number"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g. KA0120200001234"
              maxLength={32}
              autoComplete="off"
              required
              disabled={busy}
            />
            <span className="fine">Automatically accepted upon saving.</span>
          </label>

          <button className="primary wide" type="submit" disabled={busy}>
            {busy ? "Saving…" : setupComplete ? "Update driver setup" : "Save driver setup"}
          </button>
        </form>
      </section>
    </section>
  );
}
