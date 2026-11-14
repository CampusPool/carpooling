import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RideSafety from "../components/RideSafety";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("saves an unsafe check only after explicit consent and notifies the selected contact", async () => {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    calls.push([String(url), options]);
    return new Response(JSON.stringify(String(url).endsWith("trusted-contact") && options.method !== "PUT"
      ? { email: null } : { data: { safe: false, notification_status: "provider_accepted" } }), { status: 200 });
  }));
  render(<RideSafety token="test-token" tripId={23} />);
  fireEvent.click(screen.getByRole("button", { name: "I don't feel safe" }));
  fireEvent.change(screen.getByLabelText("Trusted contact email"), { target: { value: "trusted@example.test" } });
  expect(screen.getByRole("button", { name: "Notify trusted contact" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Notify trusted contact" }));
  await screen.findByText(/accepted by the email provider/);
  const contact = calls.find(([url, init]) => url.endsWith("trusted-contact") && init.method === "PUT");
  const alert = calls.find(([url, init]) => url.endsWith("/23/safety-check") && init.method === "POST");
  expect(JSON.parse(contact[1].body)).toEqual({ email: "trusted@example.test", consent_confirmed: true });
  expect(JSON.parse(alert[1].body)).toEqual({ safe: false });
  expect(alert[1].headers["Idempotency-Key"]).toBeTruthy();
});

it("does not send an alert or request a contact when the rider says they are safe", async () => {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    calls.push([String(url), options]);
    return new Response(JSON.stringify({ data: { safe: true, notification_status: "not_required" } }), { status: 200 });
  }));
  render(<RideSafety token="test-token" tripId={23} />);
  fireEvent.click(screen.getByRole("button", { name: "I'm safe" }));
  expect(await screen.findByText("Thanks for checking in.")).toBeVisible();
  expect(calls.some(([url, init]) => url.endsWith("trusted-contact") && init.method === "PUT")).toBe(false);
  expect(calls.some(([url, init]) => url.endsWith("/23/safety-check") && JSON.parse(init.body).safe === true)).toBe(true);
});
