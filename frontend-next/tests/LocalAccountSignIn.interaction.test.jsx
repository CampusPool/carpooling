import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocalAccountSignIn from "../components/LocalAccountSignIn";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("local username/password account screen", () => {
  it("registers a role-specific account and sends its session to the app", async () => {
    const signedIn = vi.fn(async () => {});
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init = {}) => {
      calls.push({ url: String(input), method: init.method || "GET", body: init.body });
      if (String(input) === "/api/mobility/local-auth/config") return json({ enabled: true });
      if (String(input) === "/api/mobility/local-auth/register") return json({ token: "session-token", role: "driver", user: { id: 10, name: "demo_driver" } }, 201);
      throw new Error(`Unhandled ${input}`);
    }));

    render(<LocalAccountSignIn request={async (path, _token, method, body) => {
      const response = await fetch(`/api/mobility/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const value = await response.json(); if (!response.ok) throw Object.assign(new Error("Request failed"), { code: value.error?.code }); return value;
    }} busy={false} onSignedIn={signedIn} />);

    await screen.findByRole("heading", { name: "Local demo account" });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "demo_driver" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "driver-pass-123" } });
    fireEvent.change(screen.getByLabelText("Account type"), { target: { value: "driver" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(signedIn).toHaveBeenCalledWith("session-token", "driver"));
    const payload = JSON.parse(calls.find((call) => call.url.endsWith("/register")).body);
    expect(payload).toEqual({ username: "demo_driver", password: "driver-pass-123", role: "driver" });
  });

  it("does not offer account registration when the server disables the local pilot", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ enabled: false })));
    const request = async () => await (await fetch("/api/mobility/local-auth/config")).json();
    render(<LocalAccountSignIn request={request} busy={false} onSignedIn={vi.fn()} />);
    expect(await screen.findByText(/available in the local pilot environment/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
});
