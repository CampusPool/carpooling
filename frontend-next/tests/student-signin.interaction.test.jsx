import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import StudentSignIn from "../components/StudentSignIn";

afterEach(cleanup);

it("requests a code and submits student registration before starting a session", async () => {
  const request = vi.fn(async (path, _token, _method, payload) => {
    if (path === "college-auth/config") return { delivery_available: true, campuses: ["CAMPUS-BLR"] };
    if (path === "college-auth/request") return { challenge_id: "challenge" };
    if (path === "college-auth/verify") {
      if (!payload.name) throw Object.assign(new Error("Profile required"), { code: "STUDENT_NAME_INVALID" });
      return { token: "session" };
    }
    throw Error("unexpected request");
  });
  const onSignedIn = vi.fn(async () => {});
  render(<StudentSignIn request={request} onSignedIn={onSignedIn} busy={false} />);
  fireEvent.change(screen.getByLabelText("College email or SRN"), { target: { value: "student@stu.pes.edu" } });
  const send = screen.getByRole("button", { name: "Send code" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  await screen.findByLabelText("Verification code");
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByText("Verify and sign in"));
  await screen.findByRole("heading", { name: "Complete your profile" });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Student Name" } });
  fireEvent.change(screen.getByLabelText("SRN"), { target: { value: "PES1UG24AM000" } });
  await screen.findByRole("option", { name: "Bengaluru" });
  fireEvent.change(screen.getByLabelText("Campus"), { target: { value: "CAMPUS-BLR" } });
  fireEvent.click(screen.getByText("Verify and sign in"));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("session"));
  expect(request).toHaveBeenCalledWith("college-auth/verify", "", "POST", { challenge_id: "challenge", code: "123456", name: "Student Name", srn: "PES1UG24AM000", campus_code: "CAMPUS-BLR" });
});

it("does not create a session when verification fails", async () => {
  const request = vi.fn(async (path) => {
    if (path === "college-auth/config") return { delivery_available: true, campuses: [] };
    if (path === "college-auth/request") return { challenge_id: "challenge" };
    throw Error("That code is incorrect.");
  });
  const onSignedIn = vi.fn();
  render(<StudentSignIn request={request} onSignedIn={onSignedIn} busy={false} />);
  fireEvent.change(screen.getByLabelText("College email or SRN"), { target: { value: "student@stu.pes.edu" } });
  const send = screen.getByRole("button", { name: "Send code" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  await screen.findByLabelText("Verification code");
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "000000" } });
  fireEvent.click(screen.getByText("Verify and sign in"));
  expect(await screen.findByRole("alert")).toHaveTextContent("That code is incorrect.");
  expect(onSignedIn).not.toHaveBeenCalled();
});

it("rejects non-PES email on the client without sending an OTP", async () => {
  const request = vi.fn(async path => path === "college-auth/config" ? { delivery_available: true, campuses: [] } : {});
  render(<StudentSignIn request={request} onSignedIn={vi.fn()} busy={false} />);
  fireEvent.change(screen.getByLabelText("College email or SRN"), { target: { value: "attacker@gmail.com" } });
  const send = screen.getByRole("button", { name: "Send code" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  expect(await screen.findByRole("alert")).toHaveTextContent("@stu.pes.edu");
  expect(request).not.toHaveBeenCalledWith("college-auth/request", "", "POST", expect.anything());
});

it("shows the server-provided OTP expiry and enforces initial resend cooldown", async () => {
  const request = vi.fn(async path => {
    if (path === "college-auth/config") return { delivery_available: true, campuses: [] };
    if (path === "college-auth/request") return { challenge_id: "new-challenge", expires_in: 60, resend_after: 60 };
    throw Error("unexpected request");
  });
  render(<StudentSignIn request={request} onSignedIn={vi.fn()} busy={false} />);
  fireEvent.change(screen.getByLabelText("College email or SRN"), { target: { value: "Student@STU.PES.EDU" } });
  const send = screen.getByRole("button", { name: "Send code" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
  await screen.findByLabelText("Verification code");
  expect(screen.getByRole("status")).toHaveTextContent("Code expires in 1:00");
  expect(screen.getByText("Resend available in 1:00")).toBeDisabled();
  expect(request).toHaveBeenCalledWith("college-auth/request", "", "POST", { email: "student@stu.pes.edu" });
});

it("disables sending when the mail transport is unavailable", async () => {
  const request = vi.fn(async () => ({ delivery_available: false, campuses: [] }));
  render(<StudentSignIn request={request} onSignedIn={vi.fn()} busy={false} />);
  expect(await screen.findByRole("status")).toHaveTextContent("Email sign-in is temporarily unavailable");
  expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
  expect(request).toHaveBeenCalledTimes(1);
});
