"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Json = Record<string, any>;
const rows = (value: any): Json[] => Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : [];
const labels: Record<string, string> = {
  driver_license: "Driver licence", profile_photo: "Profile photo", rc: "Registration certificate",
  insurance: "Insurance", permit: "Permit", fitness: "Fitness certificate", puc: "PUC certificate",
  identity_or_address: "Identity or address proof", ownership_noc: "Owner permission (if applicable)",
};
const expiring = new Set(["driver_license", "rc", "insurance", "permit", "fitness", "puc"]);
const statusLabel: Record<string, string> = {
  pending: "Waiting for manual review", needs_resubmission: "Correction requested", approved: "Approved by an operator",
  rejected: "Application declined", suspended: "Driver access suspended", submitted: "Uploaded", accepted: "Accepted",
  missing: "Needed", needs_review: "Under review", needs_resubmission_doc: "Correction requested",
};

async function call(path: string, token: string, method = "GET", body?: Json) {
  const response = await fetch(path.startsWith("/api/") ? path : `/api/${path}`, {
    method,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("mobility:unauthorized"));
    const code = data?.error?.code;
    const detail = data?.message || data?.error?.message || code || `Request failed (${response.status})`;
    throw new Error(String(detail));
  }
  return data;
}

export default function DriverOnboarding({ token }: { token: string }) {
  const [applications, setApplications] = useState<Json[]>([]);
  const [vehicles, setVehicles] = useState<Json[]>([]);
  const [colours, setColours] = useState<Json[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [applicationsResponse, vehicleResponse, colourResponse] = await Promise.all([
        call("mobility/driver-onboarding/me", token), call("cars", token), call("car-colors", token),
      ]);
      setApplications(rows(applicationsResponse));
      setVehicles(rows(vehicleResponse));
      setColours(rows(colourResponse));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load driver onboarding."); }
  }, [token]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>, action: () => Promise<void>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "The request failed. Please try again."); }
    finally { setBusy(false); }
  }

  async function createVehicle(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    await submit(event, async () => {
      const values = Object.fromEntries(new FormData(form).entries());
      await call("cars", token, "POST", values);
      setNotice("Vehicle added. Select it when starting your driver application."); form.reset(); await refresh();
    });
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    await submit(event, async () => {
      const values = Object.fromEntries(new FormData(form).entries());
      const result = await call("mobility/driver-onboarding", token, "POST", values);
      setNotice(`Application ${result.status || "started"}. Upload the checklist documents below.`); form.reset(); await refresh();
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>, app: Json) {
    const form = event.currentTarget;
    await submit(event, async () => {
      const values = Object.fromEntries(new FormData(form).entries());
      await call(`mobility/driver-onboarding/${app.id}/profile`, token, "PUT", { ...values, expected_version: Number(app.version) });
      setNotice("Driver profile saved."); await refresh();
    });
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>, app: Json, doc: Json) {
    const form = event.currentTarget;
    await submit(event, async () => {
      const values = new FormData(form);
      if (!values.get("document")) throw new Error("Choose a PDF, JPG, or PNG file.");
      values.set("document_type", doc.document_type);
      values.set("expected_version", String(app.version));
      const response = await fetch(`/api/mobility/driver-onboarding/${app.id}/documents`, {
        method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, body: values, cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event("mobility:unauthorized"));
        if (response.status === 409) await refresh();
        throw new Error(result?.message || result?.error?.code || `Upload failed (${response.status})`);
      }
      setNotice(`${labels[doc.document_type] || "Document"} uploaded as a private revision.`); await refresh();
    });
  }

  async function sendForReview(app: Json) {
    setBusy(true); setError(""); setNotice("");
    try {
      await call(`mobility/driver-onboarding/${app.id}/submit`, token, "POST", { expected_version: Number(app.version) });
      setNotice("Checklist sent for manual operator review. You can refresh here to see the decision or correction request."); await refresh();
    } catch (e) { if (String(e).includes("VERSION_CONFLICT")) await refresh(); setError(e instanceof Error ? e.message : "Could not submit the checklist."); }
    finally { setBusy(false); }
  }

  return <section className="onboarding-page" aria-labelledby="onboarding-title">
    <div className="section-head"><div><p className="eyebrow">DRIVER SETUP</p><h3 id="onboarding-title">Driver profile and vehicle review</h3></div><button type="button" className="secondary" onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
    <p className="fine">Add an owned vehicle, complete the private document checklist, then submit it for a human operator decision. Documents are not externally verified by this app. Approval is required before the vehicle can publish rides.</p>
    {error && <p className="error banner" role="alert">{error}</p>}{notice && <p className="banner" role="status">{notice}</p>}

    <section className="onboarding-panel"><h4>1 · Your owned vehicles</h4>
      {vehicles.length ? <ul className="vehicle-list">{vehicles.map((vehicle) => <li key={vehicle.id || vehicle.car_id}><strong>{vehicle.brand || vehicle.brand_other || "Vehicle"} {vehicle.model || vehicle.model_other || ""}</strong><span>{vehicle.patente || vehicle.registration || "Registration on file"} · {vehicle.year || "Year unavailable"}</span></li>)}</ul> : <p className="fine">No vehicle is available yet. Add yours below; the server checks ownership and completeness.</p>}
      <details><summary>Add a vehicle</summary><form className="form-grid onboarding-form" onSubmit={createVehicle}>
        <label>Registration number<input name="patente" maxLength={10} autoComplete="off" required /></label>
        <label>Make<input name="brand_other" maxLength={100} required /></label><label>Model<input name="model_other" maxLength={100} required /></label>
        <label>Colour<select name="car_color_id" required defaultValue=""><option value="" disabled>Select a colour</option>{colours.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Year<input name="year" type="number" min="1900" max={new Date().getFullYear()} required /></label>
        <button className="primary wide" disabled={busy}>Save owned vehicle</button>
      </form></details>
    </section>

    <section className="onboarding-panel"><h4>2 · Start an application</h4><form className="form-grid onboarding-form" onSubmit={createApplication}>
      <label>Owned vehicle<select name="car_id" required defaultValue=""><option value="" disabled>Select a vehicle</option>{vehicles.map((v) => <option key={v.id || v.car_id} value={v.id || v.car_id}>{[v.brand || v.brand_other, v.model || v.model_other, v.patente || v.registration].filter(Boolean).join(" · ")}</option>)}</select></label>
      <label>Vehicle used for rides<select name="vehicle_type" defaultValue="car"><option value="car">Car</option><option value="bike">Motorbike</option></select></label>
      <label>Legal passenger seats<input name="legal_passenger_capacity" type="number" min="1" step="1" required /><span className="fine">Enter seats available to passengers, excluding the driver. An operator checks this against the registration certificate. Motorbikes allow at most one passenger.</span></label>
      <label>Driver display name<input name="profile_display_name" maxLength={120} autoComplete="name" required /></label><label>Phone (optional)<input name="profile_phone" maxLength={32} autoComplete="tel" inputMode="tel" /></label>
      <button className="primary wide" disabled={busy || vehicles.length === 0}>Start application</button>
      {vehicles.length === 0 && <p className="fine wide">Add a complete vehicle first. The server will confirm it belongs to your account.</p>}
    </form></section>

    <div className="onboarding-applications"><h4>3 · Application checklist</h4>
      {applications.length === 0 ? <div className="empty">Your applications will appear here after you start one.</div> : applications.map((app) => {
        const checklist: Json[] = Array.isArray(app.checklist) ? app.checklist : [];
        const capacityCorrectionRequired = app.status === "approved" && app.legal_passenger_capacity == null;
        const editable = ["pending", "needs_resubmission", "rejected"].includes(app.status) || capacityCorrectionRequired;
        const vehicle = app.vehicle || {};
        return <article className="onboarding-panel application-card" key={app.id}>
          <div className="section-head"><div><h4>{app.profile_display_name || "Driver application"}</h4><p className="fine">{vehicle.brand || vehicle.brand_other || "Vehicle"} {vehicle.model || vehicle.model_other || ""} · {app.vehicle_type || "vehicle"} · Version {app.version}</p></div><span className={`review-state ${app.status}`}>{statusLabel[app.status] || app.status}</span></div>
          {app.review_reason && <p className="review-note"><strong>Operator note:</strong> {app.review_reason}</p>}
          {capacityCorrectionRequired && <p className="review-note">This older approval has no reviewed passenger capacity. Publishing is disabled until you provide the passenger seat count and an operator reviews it against your registration certificate.</p>}
          {editable && <form className="form-grid onboarding-form profile-form" onSubmit={(e) => saveProfile(e, app)}><label>Display name<input name="profile_display_name" maxLength={120} defaultValue={app.profile_display_name || ""} required /></label><label>Phone (optional)<input name="profile_phone" maxLength={32} defaultValue={app.profile_phone || ""} /></label><label>Legal passenger seats<input name="legal_passenger_capacity" type="number" min="1" step="1" defaultValue={app.legal_passenger_capacity || ""} required /><span className="fine">Excluding driver; the operator checks this against the registration certificate.</span></label><button className="secondary" disabled={busy}>Save profile</button></form>}
          <p className="fine">Declared passenger seats: {app.legal_passenger_capacity ?? "not provided"}{capacityCorrectionRequired ? " · review required before publishing" : app.status === "approved" ? " · reviewed with the vehicle documents" : " · awaiting operator review"}</p>
          <ul className="checklist">{checklist.map((doc) => <li className={`checklist-item ${doc.status}`} key={doc.document_type}>
            <div><strong>{labels[doc.document_type] || doc.document_type}</strong><span>{doc.required ? "Required" : "Optional"} · {statusLabel[doc.status] || doc.status}{doc.expires_at ? ` · expires ${doc.expires_at}` : ""}</span>{doc.review_reason && <small>Correction: {doc.review_reason}</small>}</div>
            {editable && doc.status !== "accepted" && <form className="upload-form" onSubmit={(e) => uploadDocument(e, app, doc)}>
              <label>{doc.status === "needs_resubmission" ? "Upload corrected file" : "Upload document"}<input type="file" name="document" accept="application/pdf,image/jpeg,image/png" required /></label>
              {expiring.has(doc.document_type) && <label>Expiry date<input type="date" name="expires_at" defaultValue={doc.expires_at || ""} required /></label>}
              <button className="secondary" disabled={busy}>Upload private document</button>
            </form>}
          </li>)}</ul>
          {editable && <button className="primary" type="button" disabled={busy || checklist.some((d) => d.required && (d.status !== "submitted" && d.status !== "accepted" || (expiring.has(d.document_type) && (!d.expires_at || d.expires_at < new Date().toISOString().slice(0, 10)))))} onClick={() => void sendForReview(app)}>Submit checklist for review</button>}
          {app.status === "approved" && !capacityCorrectionRequired && <p className="fine">The backend records an operator approval. Keep your vehicle details and document dates current.</p>}
        </article>;
      })}
    </div>
  </section>;
}
