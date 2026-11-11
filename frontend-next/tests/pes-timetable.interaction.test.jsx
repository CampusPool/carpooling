import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PesTimetable from "../components/PesTimetable";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function respond(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

it("persists additions, edits, and removal within the signed-in account", async () => {
  let saved = [];
  const request = vi.fn(async (path, options) => {
    expect(path).toBe("/api/mobility/commute/pes-timetable");
    expect(options.headers.get("Authorization")).toBe("Bearer student-session");
    if (options.method === "PUT") saved = JSON.parse(options.body).entries;
    if (options.method === "DELETE") saved = [];
    return respond({ data: saved });
  });
  vi.stubGlobal("fetch", request);

  const page = render(<PesTimetable token="student-session" />);
  expect(await screen.findByText("No classes yet.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Database systems" } });
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "08:30" } });
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "09:30" } });
  fireEvent.click(screen.getByRole("button", { name: "Add class" }));
  expect(await screen.findByText("Class added.")).toBeInTheDocument();
  expect(saved).toEqual([{ day: 2, dayName: "Tuesday", slot: 1, option: 1, title: "Database systems", start: "08:30", end: "09:30" }]);
  expect(screen.getByRole("region", { name: "Tuesday" })).toHaveTextContent("Database systems");

  page.unmount();
  render(<PesTimetable token="student-session" />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit Database systems" }));
  fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Database systems lab" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Class updated.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove Database systems lab" }));
  expect(await screen.findByText("No classes yet.")).toBeInTheDocument();
  expect(saved).toEqual([]);
});

it("keeps editing disabled if the saved schedule could not be loaded", async () => {
  const request = vi.fn(async () => respond({ error: "Unavailable" }, 503));
  vi.stubGlobal("fetch", request);
  render(<PesTimetable token="student-session" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your timetable");
  expect(screen.queryByRole("button", { name: "Add class" })).not.toBeInTheDocument();
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
});

it("reviews Academy options before replacing saved classes and clears the password immediately", async () => {
  let saved = [{ day: 1, title: "Existing class", start: "10:00", end: "11:00", slot: 1, option: 1 }];
  const request = vi.fn(async (path, options) => {
    if (path === "/api/pes-timetable") return respond({ data: { entries: [
      { day: 2, slot: 1, option: 1, title: "Subject A", start: "08:00", end: "09:00" },
      { day: 2, slot: 1, option: 2, title: "Subject B", start: "08:00", end: "09:00" },
    ] } });
    if (options.method === "PUT") saved = JSON.parse(options.body).entries;
    return respond({ data: saved });
  });
  vi.stubGlobal("fetch", request); render(<PesTimetable token="student-session" />);
  expect(await screen.findByRole("button", { name: "Edit Existing class" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Academy SRN"), { target: { value: "synthetic-srn" } });
  fireEvent.change(screen.getByLabelText("Academy password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Import from PES Academy" }));
  expect(screen.getByLabelText("Academy password")).toHaveValue("");
  const replace = await screen.findByRole("button", { name: "Replace saved timetable" });
  expect(replace).toBeDisabled(); expect(saved[0].title).toBe("Existing class");
  fireEvent.change(screen.getByLabelText(/Tuesday 08:00/), { target: { value: "2" } });
  expect(replace).toBeEnabled(); fireEvent.click(replace);
  expect(await screen.findByText("Imported timetable saved.")).toBeInTheDocument();
  expect(saved).toEqual([{ day: 2, dayName: "Tuesday", slot: 1, option: 1, title: "Subject B", start: "08:00", end: "09:00" }]);
});
