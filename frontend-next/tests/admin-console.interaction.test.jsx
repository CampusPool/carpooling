import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminConsole from '../components/AdminConsole';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fixtures = {
  '/api/mobility/operator/dashboard': { audience: 'operator', usage: { reports_open: 1 }, reports: [{ id: 8, trip_id: 32, subject: 'Help', priority: 'high', status: 'Open' }] },
  '/api/mobility/operator/analytics?days=7': { audience: 'operator', sql: { summary: { rides: 3, accepted_seats: 1, pending_requests: 1, completed: 1, over_capacity_rides: 0 }, rides: [{ trip_id: 32, total_seats: 1, accepted_seats: 1, state: 'planned', departure_at: '2026-11-12T03:00:00Z' }], audit: [], daily: [] }, activity: { status: 'disabled', daily: [] } },
  '/api/mobility/operator/memberships?page_size=100': { data: [{ user_id: 21, name: 'Student A', email: 'a@example.invalid', college_code: 'CAMPUS-BLR', affiliation: 'student', status: 'pending', version: 3 }], pagination: { has_more: false } },
  '/api/mobility/operator/host-applications?page_size=100': { data: [] },
  '/api/mobility/operator/driver-onboarding?status=all&limit=50': { data: [] },
  '/api/mobility/operator/cash-disputes?page_size=100': { audience: 'operator', data: [] },
  '/api/mobility/operator/dbms/health': { audience: 'operator', tables: [{ name: 'mobility_memberships', exists: true, rows: 1, purpose: 'College reviews' }], objects: [{ name: 'mobility_operator_ride_facts', kind: 'VIEW', installed: true }] },
};
function signIn() {
  fireEvent.change(screen.getByLabelText('Administrator email'), { target: { value: 'operator@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-a-real-password' } });
  fireEvent.click(screen.getByRole('button', { name: /Enter control center/ }));
}
const fetcher = (handler) => vi.fn(async (path, opts = {}) => {
  if (path === '/api/login') return json({ token: 'fake-token' });
  if (path === '/api/mobility/commute/me') return json({ operator: true });
  if (handler) { const handled = await handler(path, opts); if (handled) return handled; }
  if (Object.prototype.hasOwnProperty.call(fixtures, path)) return json(fixtures[path]);
  throw new Error(`Unexpected request ${opts.method ?? 'GET'} ${path}`);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('CampusPool dedicated admin control center', () => {
  it('rejects non-operators before loading any operational data', async () => {
    const fetch = vi.fn(async (path) => {
      if (path === '/api/login') return json({ token: 'rider-token' });
      if (path === '/api/mobility/commute/me') return json({ operator: false });
      throw new Error(`Unauthorized request ${path}`);
    });
    vi.stubGlobal('fetch', fetch);
    render(<AdminConsole />); signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('does not have administrator access');
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('requires the backend operator scope even when identity claims admin', async () => {
    const fetch = fetcher((path) => path === '/api/mobility/operator/dashboard' ? json({ error: { code: 'OPERATOR_FORBIDDEN' } }, 403) : undefined);
    vi.stubGlobal('fetch', fetch);
    render(<AdminConsole />); signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed');
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument();
  });

  it('renders real report rows and submits a versioned audited membership decision', async () => {
    const changes = [];
    const fetch = fetcher((path, opts) => {
      if (path === '/api/mobility/operator/memberships/21/decision') {
        changes.push({ method: opts.method, body: JSON.parse(opts.body), bearer: opts.headers.get('Authorization') });
        return json({ id: 21, status: 'approved', version: 4 });
      }
    });
    vi.stubGlobal('fetch', fetch);
    render(<AdminConsole />); signIn();
    await waitFor(() => expect(screen.getByText('Published rides').parentElement).toHaveTextContent('3'));
    fireEvent.click(screen.getByRole('button', { name: /Memberships/ }));
    await screen.findByText('Student A');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = screen.getByRole('dialog');
    const confirm = screen.getByRole('button', { name: 'Confirm reviewed decision' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason for decision'), { target: { value: 'College membership checked for demo' } });
    expect(dialog).toHaveTextContent('Expected database version: 3');
    fireEvent.click(confirm);
    await waitFor(() => expect(changes).toHaveLength(1));
    expect(changes[0]).toMatchObject({ method: 'POST', bearer: 'Bearer fake-token', body: { status: 'approved', expected_version: 3, reason: 'College membership checked for demo' } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears privileged data on sign out and does not reuse the token', async () => {
    const fetch = fetcher(); vi.stubGlobal('fetch', fetch);
    render(<AdminConsole />); signIn();
    await screen.findByText('Published rides');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('Administrator sign in')).toBeInTheDocument();
    expect(screen.queryByText('Published rides')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).not.toBeInTheDocument();
  });

  it('shows live SQL metadata and degrades gracefully if MongoDB is unavailable', async () => {
    vi.stubGlobal('fetch', fetcher());
    render(<AdminConsole />); signIn();
    await screen.findByText('Published rides');
    fireEvent.click(screen.getByRole('button', { name: /Database lab/ }));
    expect(screen.getByText('mobility_operator_ride_facts')).toBeInTheDocument();
    expect(screen.getByText('mobility_memberships')).toBeInTheDocument();
    expect(screen.getByText('MongoDB activity reporting')).toBeInTheDocument();
    expect(screen.getByText('No accessible projection results (may be disabled, stale or missing).')).toBeInTheDocument();
  });
});
