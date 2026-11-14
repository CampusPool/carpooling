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
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Student Name" } });
  fireEvent.change(screen.getByLabelText("SRN"), { target: { value: "PES1UG24AM000" } });
  expect(screen.queryByLabelText("Campus")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "prefer_not_to_say" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByText("Verify and sign in"));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("session"));
  expect(request).toHaveBeenCalledWith("college-auth/verify", "", "POST", { challenge_id: "challenge", code: "123456", name: "Student Name", srn: "PES1UG24AM000", campus_code: "CAMPUS-BLR", gender_identity: "prefer_not_to_say", phone: "9876543210" });
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
it("collects the student profile and gender before verifying username registration", async () => {
  const request = vi.fn(async path => path === "college-auth/config" ? { delivery_available: true, campuses: ["CAMPUS-BLR"] }
    : path === "college-auth/request" ? { challenge_id: "register-code" } : { token: "registered-token" });
  const onSignedIn = vi.fn(async () => {});
  render(<StudentSignIn request={request} onSignedIn={onSignedIn} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  fireEvent.change(screen.getByLabelText("College email or SRN"), { target: { value: "student@stu.pes.edu" } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "student.one" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-1234" } });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Student One" } });
  fireEvent.change(screen.getByLabelText("SRN"), { target: { value: "PES1UG24CS123" } });
  fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "woman" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9876543210" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("registered-token"));
  expect(request).toHaveBeenCalledWith("college-auth/verify", "", "POST", expect.objectContaining({
    password_action: "register", username: "student.one", gender_identity: "woman", name: "Student One",
  }));
});

it("supports account login and requests an email code for password reset", async () => {
  const request = vi.fn(async path => path === "college-auth/config" ? { delivery_available: true, campuses: ["CAMPUS-BLR"] }
    : path === "college-auth/request" ? { challenge_id: "reset-code" } : { token: "reset-token" });
  const onSignedIn = vi.fn(async () => {});
  render(<StudentSignIn request={request} onSignedIn={onSignedIn} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Account sign-in" }));
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(screen.getByLabelText("College email or SRN"), { target: { value: "student@stu.pes.edu" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password and sign in" }));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("reset-token"));
  expect(request).toHaveBeenCalledWith("college-auth/verify", "", "POST", expect.objectContaining({
    challenge_id: "reset-code", password_action: "reset", password: "new-password-123",
  }));
});


it("remembers a password login through the existing protected session endpoint", async () => {
  const request = vi.fn(async path => path === "college-auth/config" ? { delivery_available: true, campuses: ["CAMPUS-BLR"] } : path === "college-auth/password-login" ? { token: "password-token" } : {});
  const onSignedIn = vi.fn(async () => {});
  render(<StudentSignIn request={request} onSignedIn={onSignedIn} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Account sign-in" }));
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "student.one" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("password-token"));
  expect(request).toHaveBeenCalledWith("college-auth/session", "password-token", "POST");
});
