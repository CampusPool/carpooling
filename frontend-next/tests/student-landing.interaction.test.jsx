import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Page from "../app/page";

vi.mock("../components/LiveCarpool", () => ({ default: () => <div>Private ride planner</div> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}


it("public student mode exposes only verified-student OTP and hides synthetic/demo sign-in", async () => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    if (String(input) === "/api/mobility/college-auth/config") {
      return json({ student_only: true, campuses: ["CAMPUS-BLR"], delivery_available: true });
    }
    if (String(input) === "/api/mobility/college-auth/request") return json({ challenge_id: "synthetic-challenge" }, 201);
    return json({ error: { code: "NOT_FOUND" } }, 404);
  }));
  render(<Page />);
  const studentHeading = await screen.findByText("Student sign-in or registration");
  expect(studentHeading).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Local demo account" })).not.toBeInTheDocument();
  expect(screen.queryByText("Administrator sign-in")).not.toBeInTheDocument();
  fireEvent.click(studentHeading);
  fireEvent.change(screen.getByLabelText("College email"), { target: { value: "student@stu.pes.edu" } });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("5:00");
});
