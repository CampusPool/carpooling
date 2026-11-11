'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from '../lib/legacy-api';
import styles from './AdminConsole.module.css';

type Row = Record<string, any>;
type Tab = 'overview' | 'members' | 'vehicles' | 'hosts' | 'rides' | 'support' | 'finance' | 'dbms';
type Dataset = {
  dashboard?: Row; analytics?: Row; members?: Row; hosts?: Row;
  onboarding?: Row; cash?: Row; dbms?: Row;
};
type Review = { kind: 'member' | 'host' | 'vehicle'; row: Row; action: string };
const navigation: { id: Tab; label: string; icon: string; subtitle: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◫', subtitle: 'Live operational pulse' },
  { id: 'members', label: 'Memberships', icon: '♙', subtitle: 'College access and approval' },
  { id: 'vehicles', label: 'Driver & vehicles', icon: '▣', subtitle: 'Onboarding review' },
  { id: 'hosts', label: 'Host permissions', icon: '⇄', subtitle: 'Vehicle hosting requests' },
  { id: 'rides', label: 'Rides & bookings', icon: '⌁', subtitle: 'Capacity, decisions and audits' },
  { id: 'support', label: 'Support desk', icon: '◇', subtitle: 'Safety and trip reports' },
  { id: 'finance', label: 'Reconciliation', icon: '◈', subtitle: 'Cash conflicts, demo money' },
  { id: 'dbms', label: 'Database lab', icon: '▤', subtitle: 'SQL and MongoDB evidence' },
];
const config = [
  ['dashboard', 'operator/dashboard'], ['analytics', 'operator/analytics'],
  ['members', 'operator/memberships?page_size=100'], ['hosts', 'operator/host-applications?page_size=100'],
  ['onboarding', 'operator/driver-onboarding?status=all&limit=50'],
  ['cash', 'operator/cash-disputes?page_size=100'], ['dbms', 'operator/dbms/health'],
] as const;
const list = (data?: Row): Row[] => Array.isArray(data?.data) ? data.data : [];
const n = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const label = (value: unknown): string => value == null || value === '' ? '—' : String(value);
const localDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? label(value) : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
};
const stateName = (value: unknown) => ['Requested', 'Accepted', 'Declined', 'Cancelled'][n(value)] ?? label(value);
function Tag({ value }: { value: unknown }) {
  const text = label(value);
  const good = /approved|accepted|completed|ready|confirmed|healthy/i.test(text);
  const bad = /rejected|suspended|cancelled|alert|disputed|unavailable|conflict/i.test(text);
  return <span className={`${styles.tag} ${good ? styles.good : bad ? styles.bad : styles.warn}`}>{text.replaceAll('_', ' ')}</span>;
}
function Table({ headings, rows, empty = 'No matching records in this result.', footer }: { headings: string[]; rows: React.ReactNode[][]; empty?: string; footer?: string }) {
  return <div className={styles.tableBox}><div className={styles.tableScroll}><table><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headings.length} className={styles.empty}>{empty}</td></tr>}</tbody></table></div>{footer && <p className={styles.tableFooter}>{footer}</p>}</div>;
}
function Chart({ rows }: { rows: Row[] }) {
  const recent = rows.slice(-14);
  const peak = Math.max(1, ...recent.map(row => n(row.rides)));
  return <div className={styles.chart} role="img" aria-label="Daily scheduled rides over the selected reporting window">{recent.map(row => <div key={label(row.day)} className={styles.chartColumn} title={`${row.day}: ${row.rides} rides`}><span>{n(row.rides) || ''}</span><div className={styles.chartBar} style={{ height: `${Math.max(4, n(row.rides) / peak * 100)}%` }} /><small>{String(row.day).slice(5)}</small></div>)}</div>;
}

export default function AdminConsole() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [actor, setActor] = useState<Row | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState(7);
  const [revision, setRevision] = useState(0);
  const [dataset, setDataset] = useState<Dataset>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<Row | null>(null);
  const [ride, setRide] = useState<Row | null>(null);
  const [rideId, setRideId] = useState('');
  const generation = useRef(0);

  function exit() {
    generation.current += 1;
    setToken(''); setActor(null); setDataset({}); setFailed({});
    setReview(null); setTicket(null); setRide(null); setPassword(''); setError(''); setNotice('');
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSigningIn(true); setError(''); setNotice('');
    const sequence = ++generation.current;
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }), cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Error('Administrator credentials were rejected.');
      const candidate = body.token ?? body.data?.token;
      if (typeof candidate !== 'string' || !candidate) throw Error('The authentication service did not return a valid session.');
      const identity = await request('commute/me', candidate);
      if (identity?.operator !== true) throw Error('This account does not have administrator access.');
      const scope = await request('operator/dashboard', candidate);
      if (scope?.audience !== 'operator') throw Error('The operator authorization check failed.');
      if (generation.current !== sequence) return;
      setActor(identity); setToken(candidate); setPassword(''); setTab('overview');
    } catch (e) { if (generation.current === sequence) setError(e instanceof Error ? e.message : 'Could not sign in.'); }
    finally { if (generation.current === sequence) setSigningIn(false); }
  }
  useEffect(() => {
    if (!token) return;
    const id = ++generation.current;
    let active = true;
    async function refresh() {
      setLoading(true); setDataset({}); setFailed({}); setNotice('');
      const outcomes = await Promise.allSettled(config.map(async ([name, path]) => {
        const endpoint = name === 'analytics' ? `operator/analytics?days=${period}` : path;
        return [name, await request(endpoint, token)] as const;
      }));
      if (!active || generation.current !== id) return;
      const next: Dataset = {}; const unavailable: Record<string,string> = {};
      let unauthorized = false;
      outcomes.forEach((outcome, index) => {
        const name = config[index][0];
        if (outcome.status === 'fulfilled') {
          const value = outcome.value[1];
          if ((name === 'dashboard' || name === 'analytics' || name === 'cash' || name === 'dbms') && value.audience !== 'operator') unavailable[name] = 'The server returned an unexpected response.';
          else next[name] = value;
        } else {
          const issue = outcome.reason;
          if (issue?.status === 401 || issue?.status === 403 && name === 'dashboard') unauthorized = true;
          unavailable[name] = issue?.status === 404 ? 'Not installed in this backend.' : 'Currently unavailable; not counted as zero.';
        }
      });
      if (unauthorized) { exit(); setError('Session expired or operator access was removed. Sign in again.'); return; }
      setDataset(next); setFailed(unavailable); setLoading(false);
    }
    void refresh();
    return () => { active = false; };
  }, [token, period, revision]);

  async function decide() {
    if (!review || !token || !reason.trim() || reason.trim().length > 500) return;
    const selection = review;
    const key = selection.kind === 'member' ? selection.row.user_id : selection.row.id;
    const path = selection.kind === 'member' ? `operator/memberships/${key}/decision`
      : selection.kind === 'host' ? `operator/host-applications/${key}/decision`
        : `operator/driver-onboarding/${key}/review`;
    setSubmitting(true); setError(''); setNotice('');
    try {
      await request(path, token, 'POST', { status: selection.action, expected_version: selection.row.version, reason: reason.trim() });
      setNotice(`${selection.kind} #${key}: ${selection.action.replaceAll('_', ' ')} recorded with an audit reason.`);
      setReview(null); setReason(''); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'The review was not accepted. Refresh and retry.'); }
    finally { setSubmitting(false); }
  }
  async function inspectTicket(id: number) {
    if (!token) return; setError('');
    try { const result = await request(`admin/support/tickets/${id}`, token); setTicket(result.data ?? result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open the support ticket.'); }
  }
  async function ticketAction(action: 'assign-me' | 'resolve') {
    if (!ticket || !token || submitting) return;
    setSubmitting(true); setError('');
    try {
      await request(`admin/support/tickets/${ticket.id}/${action}`, token, 'POST', {});
      setNotice(`Report #${ticket.id} updated.`); setTicket(null); setRevision(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'The report action failed.'); }
    finally { setSubmitting(false); }
  }
  async function inspectRide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setRide(null);
    if (!/^[1-9]\d{0,9}$/.test(rideId)) { setError('Enter a valid numeric ride ID.'); return; }
    try { const result = await request(`operator/trips/${rideId}`, token); setRide(result.data ?? result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Trip lookup failed.'); }
  }
  const data = dataset;
  const summary: Row = data.analytics?.sql?.summary ?? {};
  const usage: Row = data.dashboard?.usage ?? {};
  const rides: Row[] = Array.isArray(data.analytics?.sql?.rides) ? data.analytics.sql.rides : [];
  const audits: Row[] = Array.isArray(data.analytics?.sql?.audit) ? data.analytics.sql.audit : [];
  const days: Row[] = Array.isArray(data.analytics?.sql?.daily) ? data.analytics.sql.daily : [];
  const members = list(data.members), hosts = list(data.hosts), vehicles = list(data.onboarding), cash = list(data.cash);
  const tickets: Row[] = Array.isArray(data.dashboard?.reports) ? data.dashboard.reports : [];
  const kpis = [
    ['Published rides', summary.rides, 'From the selected reporting period'],
    ['Accepted seats', summary.accepted_seats, 'Committed rider seats'],
    ['Pending requests', summary.pending_requests, 'Awaiting driver decisions'],
    ['Completed rides', summary.completed, 'Lifecycle completed'],
    ['Open reports', usage.reports_open, 'Support reports requiring attention'],
    ['Capacity alerts', summary.over_capacity_rides, 'Possible seat integrity problems'],
  ];

  if (!token) return <div className={styles.loginShell}>
    <div className={styles.loginSide}><a href="/" className={styles.homeLink}>← CampusPool website</a><div className={styles.logoLarge}>C<span>·</span></div><p className={styles.overline}>OPERATIONS & DATABASE MANAGEMENT</p><h1>One control center.<br/><em>Full visibility.</em></h1><p>Review campus access, driver applications, ride operations, support cases and the live SQL/MongoDB reporting layer.</p><div className={styles.loginFoot}>Role-protected · Auditable changes · Classroom demonstration</div></div>
    <div className={styles.loginFormWrap}><form className={styles.loginForm} onSubmit={login}><div className={styles.shield}>▣</div><p className={styles.overline}>RESTRICTED ACCESS</p><h2>Administrator sign in</h2><p>Use an existing administrator account. Student and driver accounts cannot open operational data.</p><label>Administrator email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" placeholder="admin@college.edu" /></label><label>Password<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></label><button className={styles.primary} disabled={signingIn} type="submit">{signingIn ? 'Verifying administrator…' : 'Enter control center →'}</button>{error && <div className={styles.error} role="alert">{error}</div>}<p className={styles.small}>No demo credentials or authentication tokens are embedded in this interface.</p></form></div>
  </div>;

  return <div className={styles.shell}>
    <aside className={styles.sidebar}><a className={styles.brand} href="/"><span className={styles.brandIcon}>C</span><span>CampusPool<small>CONTROL CENTER</small></span></a><div className={styles.navLabel}>WORKSPACE</div><nav aria-label="Admin sections">{navigation.map(item => <button type="button" key={item.id} className={`${styles.navItem} ${tab===item.id?styles.navActive:''}`} onClick={()=>{setTab(item.id);setReview(null);setRide(null);setTicket(null);setError('');}}><span className={styles.navIcon}>{item.icon}</span><span>{item.label}</span>{(item.id==='support' && n(usage.reports_open)>0) && <b className={styles.navCount}>{usage.reports_open}</b>}</button>)}</nav><div className={styles.sideBottom}><div className={styles.statusPip}>● <span>Protected operator workspace</span></div><p>MySQL is the booking authority. MongoDB is an optional reporting projection.</p><button className={styles.signout} type="button" onClick={exit}>Sign out ↗</button></div></aside>
    <div className={styles.workspace}><header className={styles.topbar}><div><span className={styles.overline}>CAMPUSPOOL / ADMINISTRATION</span><span className={styles.mobileBrand}>CampusPool Admin</span></div><div className={styles.topActions}><span className={styles.userChip}>● Operator{actor?.name ? ` · ${label(actor.name)}` : ''}</span><button type="button" className={styles.refresh} onClick={()=>setRevision(v=>v+1)} disabled={loading}>{loading?'Refreshing…':'↻ Refresh'}</button><button type="button" className={styles.mobileSignout} onClick={exit}>Sign out</button></div></header>
      <main className={styles.main}><div className={styles.pageHead}><div><p className={styles.overline}>ADMINISTRATOR WORKSPACE</p><h1>{navigation.find(x=>x.id===tab)?.label}</h1><p>{navigation.find(x=>x.id===tab)?.subtitle} · Live backend data, not generated records</p></div><div className={styles.headControls}><label>Reporting window<select value={period} onChange={e=>setPeriod(Number(e.target.value))}>{[7,14,31].map(i=><option value={i} key={i}>{i} days</option>)}</select></label></div></div>
      {loading && <div className={styles.loading} role="status">Reading authorized database reports…</div>}
      {notice && <div className={styles.success} role="status">{notice}</div>}{error && <div className={styles.error} role="alert">{error}</div>}
      {Object.keys(failed).length>0 && <details className={styles.warning}><summary>Some data sources are unavailable ({Object.keys(failed).length}). Available reports remain visible.</summary>{Object.entries(failed).map(([name,value])=><p key={name}><b>{name}:</b> {value}</p>)}</details>}
      {tab==='overview' && <><div className={styles.metrics}>{kpis.map(([name,value,hint])=><div className={styles.metric} key={String(name)}><p>{name}</p><strong>{value === undefined ? '—' : n(value).toLocaleString('en-IN')}</strong><small>{hint}</small></div>)}</div><div className={styles.twoCol}><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>TRAFFIC OVERVIEW</p><h2>Published rides by day</h2></div><Tag value={data.analytics ? 'Live SQL' : 'Unavailable'} /></div>{days.length?<Chart rows={days}/>:<p className={styles.empty}>No daily report is available for this window.</p>}</section><section className={styles.panel}><p className={styles.overline}>OPERATIONAL HEALTH</p><h2>Database dependencies</h2><div className={styles.healthRow}><span>MySQL ride analytics</span><Tag value={data.analytics?'Ready':'Unavailable'}/></div><div className={styles.healthRow}><span>MongoDB event projection</span><Tag value={data.analytics?.activity?.status ?? 'Unknown'}/></div><div className={styles.healthRow}><span>College operator scope</span><Tag value={data.dashboard?'Authorized':'Unavailable'}/></div><div className={styles.healthRow}><span>Available report window</span><b>{period} days</b></div><p className={styles.muted}>A stale or missing Mongo projection does not affect canonical booking transactions.</p></section></div><div className={styles.twoCol}><section className={styles.panel}><div className={styles.panelHead}><h2>Requests & reviews</h2><button className={styles.textButton} onClick={()=>setTab('members')}>Manage access →</button></div><div className={styles.miniStat}><span>Members awaiting review</span><strong>{members.filter(x=>x.status==='pending').length}{data.members?.pagination?.has_more?'+':''}</strong></div><div className={styles.miniStat}><span>Driver onboarding pending</span><strong>{vehicles.filter(x=>['pending','needs_resubmission'].includes(x.status)).length}{data.onboarding?.next_after?'+':''}</strong></div><div className={styles.miniStat}><span>Host applications pending</span><strong>{hosts.filter(x=>x.status==='pending').length}{data.hosts?.pagination?.has_more?'+':''}</strong></div></section><section className={styles.panel}><div className={styles.panelHead}><h2>Booking integrity</h2><button className={styles.textButton} onClick={()=>setTab('rides')}>View ride ledger →</button></div><div className={styles.miniStat}><span>Seats offered</span><strong>{data.analytics?label(summary.total_seats):'—'}</strong></div><div className={styles.miniStat}><span>Requests cancelled</span><strong>{data.analytics?label(summary.cancelled_requests):'—'}</strong></div><div className={styles.miniStat}><span>Over-capacity alerts</span><strong>{data.analytics?label(summary.over_capacity_rides):'—'}</strong></div></section></div></>}
      {tab==='members' && <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>COLLEGE MEMBERSHIP</p><h2>Access approval queue</h2></div><Tag value={`${members.length} records loaded`} /></div><p className={styles.muted}>Decisions are scoped to the configured college and checked by the backend for administrator status, self-review, and record version.</p><Table headings={['Member','College / affiliation','Status','Version','Action']} rows={members.map(row=>[<><b>{label(row.name)}</b><small>{label(row.email)}</small></>,<>{label(row.college_code)}<small>{label(row.affiliation)}</small></>,<Tag value={row.status}/>,`v${row.version}`,<div className={styles.rowActions}>{(row.status==='pending'?['approved','rejected']:row.status==='approved'?['suspended']:row.status==='suspended'?['approved']:[]).map(action=><button key={action} onClick={()=>{setReview({kind:'member',row,action});setReason('');}}>{action==='approved'?'Approve':action==='rejected'?'Reject':'Suspend'}</button>)}</div>])} footer={data.members?.pagination?.has_more?'Showing first 100 matching records; additional records exist.':'This is the current bounded result set.'}/></section>}
      {tab==='vehicles' && <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>DRIVER OPERATIONS</p><h2>Vehicle onboarding review</h2></div><Tag value={`${vehicles.length} records loaded`}/></div><p className={styles.muted}>Vehicle decisions require the backend checklist and vehicle ownership checks. Approval is never automatic and cannot be used to certify a real vehicle.</p><Table headings={['Application','Vehicle','Review checklist','Status','Action']} rows={vehicles.map(row=>[<><b>#{row.id} · User #{row.user_id}</b><small>{label(row.profile_display_name)}</small></>,<>{label(row.vehicle_type)} · vehicle #{row.car_id}<small>Legal passenger capacity: {label(row.legal_passenger_capacity)}</small></>,<>{Array.isArray(row.checklist)?row.checklist.filter((x:Row)=>x.required).map((x:Row)=><small key={label(x.document_type)}>{label(x.document_type)}: {label(x.status)}</small>):'No checklist returned'}</>,<Tag value={row.status}/>,<div className={styles.rowActions}>{['pending','needs_resubmission'].includes(row.status) && ['approved','needs_resubmission','rejected'].map(action=><button key={action} onClick={()=>{setReview({kind:'vehicle',row,action});setReason('');}}>{action==='needs_resubmission'?'Request corrections':action==='approved'?'Approve':'Reject'}</button>)}</div>])} footer={data.onboarding?.next_after?'More onboarding records exist; this page is bounded to 50.':'Document contents are not displayed by this table.'}/></section>}
      {tab==='hosts' && <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>HOST PERMISSIONS</p><h2>Host application registry</h2></div><Tag value={`${hosts.length} records loaded`}/></div><p className={styles.muted}>Modern host approvals are governed by the driver-onboarding checklist. Use the Driver & vehicles panel to complete those reviews; legacy host decisions require a separate authorized endpoint.</p><Table headings={['Application','User','Vehicle','Status','Version']} rows={hosts.map(row=>[`#${row.id}`,`User #${row.user_id}`,`${label(row.vehicle_type)} · #${row.car_id}`,<Tag value={row.status}/>,`v${row.version}`])} footer={data.hosts?.pagination?.has_more?'More than 100 host records exist.':'Read-only registry; approvals managed through onboarding.'}/></section>}
      {tab==='rides' && <><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>TRANSACTIONAL RIDES</p><h2>Ride capacity & lifecycle</h2></div><Tag value={`${rides.length} rows`}/></div><Table headings={['Ride','Departure (IST)','Status','Seats','Pending','Utilization','Integrity']} rows={rides.map(row=>[<button className={styles.textButton} onClick={()=>{setRideId(String(row.trip_id));setRide(null);}}>#{row.trip_id}</button>,localDate(row.departure_at),<Tag value={row.state}/>,`${row.accepted_seats} / ${row.total_seats}`,label(row.pending_requests),`${Number(row.utilization_pct||0).toFixed(1)}%`,<Tag value={row.capacity_alert?'Capacity alert':'Within capacity'}/>])} footer={data.analytics?.sql?.truncated?'Detail rows are truncated; do not interpret these as complete totals.':'Ride detail rows are intentionally bounded.'}/><form className={styles.lookup} onSubmit={inspectRide}><label>Inspect ride by ID<input type="text" inputMode="numeric" value={rideId} onChange={e=>setRideId(e.target.value)} placeholder="Ride ID" /></label><button className={styles.primary}>Open authorized ride</button></form>{ride && <div className={styles.detail}><h3>Ride #{rideId} details</h3><p>Backend-permitted fields only: state {label(ride.state ?? ride.lifecycle?.state)} · trip #{label(ride.trip_id ?? ride.id)}. See the decision audit below for booking history.</p><button onClick={()=>setRide(null)}>Close</button></div>}</section><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>TRANSACTION HISTORY</p><h2>Booking decision audit</h2></div></div><Table headings={['Event','Ride','Booking','Previous','New state','Occurred (IST)']} rows={audits.map(row=>[`#${row.event_id}`,`#${row.trip_id}`,row.booking_id?`#${row.booking_id}`:'Deleted reference',row.previous_state===null?'Created':stateName(row.previous_state),stateName(row.next_state),localDate(row.occurred_at)])} footer="Trigger-written audit events; not a list of unique passengers."/></section></>}
      {tab==='support' && <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>TRUST & SAFETY</p><h2>Student support tickets</h2></div><Tag value={`${tickets.length} records`}/></div><Table headings={['Report','Ride','Priority','Status','Action']} rows={tickets.map(row=>[<><b>#{row.id} · {label(row.subject)}</b>{row.unread_for_admin&&<small>Unread</small>}</>,`#${row.trip_id}`,<Tag value={row.priority}/>,<Tag value={row.status}/>,<button className={styles.textButton} onClick={()=>inspectTicket(Number(row.id))}>Open report →</button>])} footer="Ticket summaries only. Details are fetched separately with operator authorization."/>{ticket && <div className={styles.detail}><div className={styles.panelHead}><h3>Report #{ticket.id} · {label(ticket.subject)}</h3><button onClick={()=>setTicket(null)}>Close ×</button></div><p>Trip #{label(ticket.trip_id)} · {label(ticket.status)}</p><p className={styles.reportMessage}>{label(ticket.message_markdown ?? ticket.message)}</p><div className={styles.rowActions}><button disabled={submitting} onClick={()=>ticketAction('assign-me')}>Assign to me</button><button disabled={submitting} onClick={()=>ticketAction('resolve')}>Resolve report</button></div></div>}</section>}
      {tab==='finance' && <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>FINANCIAL INTEGRITY</p><h2>Cash reconciliation exceptions</h2></div><Tag value={`${cash.length} flagged rows`}/></div><p className={styles.muted}>The platform uses synthetic classroom credits. This report only identifies cash/provider conflicts and disputes; it does not transfer funds or settle payments.</p><Table headings={['Receipt','Ride / booking','Gross','Commission','Conflict','Cash state','Settlement']} rows={cash.map(row=>[`#${row.receipt_id}`,`Ride #${row.trip_id} · Booking #${row.booking_id}`,`${label(row.gross_amount)} ${label(row.currency)}`,label(row.commission_amount),<Tag value={row.reconciliation_state}/>,<Tag value={row.cash_state}/>,<Tag value={row.settlement_status}/>])} footer={data.cash?.pagination?.has_more?'Additional exceptions exist beyond this bounded page.':'No settlement actions exposed in the admin interface.'}/></section>}
      {tab==='dbms' && <><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.overline}>LEVEL 3 · SQL AUTHORITY</p><h2>Database objects & table health</h2></div><Tag value={data.dbms?'Live metadata':'Evidence catalog'}/></div><p className={styles.muted}>Safe, allow-listed metadata only. Arbitrary SQL, DDL, user-data exports, table deletion and database credentials are never exposed to the browser.</p>{data.dbms?.tables ? <Table headings={['Relational table','Exists','Rows','Role']} rows={data.dbms.tables.map((row:Row)=>[<code>{label(row.name)}</code>,<Tag value={row.exists?'Present':'Missing'}/>,row.exists?label(row.rows):'—',label(row.purpose)])}/> : <p className={styles.warning}>Live database metadata is unavailable. The code-backed object catalog below is not proof that this instance has installed every migration.</p>}<div className={styles.objectGrid}>{(data.dbms?.objects??[{name:'mobility_operator_ride_facts',kind:'VIEW'},{name:'mobility_operator_daily',kind:'PROCEDURE'},{name:'mobility_utilization_pct',kind:'FUNCTION'},{name:'mobility_booking_decision_insert',kind:'TRIGGER'},{name:'mobility_booking_decision_update',kind:'TRIGGER'}]).map((x:Row)=><div key={x.name} className={styles.object}><small>{label(x.kind)}</small><b>{label(x.name)}</b><Tag value={x.installed===undefined?'Code catalog':x.installed?'Installed':'Missing'}/></div>)}</div></section><div className={styles.twoCol}><section className={styles.panel}><p className={styles.overline}>QUERY DESIGN</p><h2>Advanced SQL in the live report</h2><div className={styles.feature}><b>JOIN + GROUP BY</b><p>Views join trips, college membership and aggregated rider decisions without counting duplicate seat rows.</p></div><div className={styles.feature}><b>Recursive CTE + window function</b><p>The daily procedure generates missing calendar dates and calculates a 7-day rolling average.</p></div><div className={styles.feature}><b>Stored function</b><p><code>mobility_utilization_pct</code> calculates the utilization percentage in SQL.</p></div><div className={styles.feature}><b>Audit triggers</b><p>INSERT and UPDATE triggers record booking decision transitions for integrity analysis.</p></div><div className={styles.feature}><b>Transactions + indexes</b><p>Booking operations lock and update canonical MySQL records atomically. Indexes accelerate scoped queries.</p></div></section><section className={styles.panel}><p className={styles.overline}>DOCUMENT PROJECTION</p><h2>MongoDB activity reporting</h2><div className={styles.healthRow}><span>Projection status</span><Tag value={data.analytics?.activity?.status??'Unknown'}/></div><div className={styles.healthRow}><span>Last successful synchronization</span><b>{localDate(data.analytics?.activity?.last_synced_at)}</b></div><div className={styles.healthRow}><span>Sync lag</span><b>{data.analytics?.activity?.lag_seconds==null?'—':`${data.analytics.activity.lag_seconds} s`}</b></div><p className={styles.muted}>Unique, replayable lifecycle events are projected from SQL and aggregated by date and action. This is not a second booking authority.</p><Table headings={['Day','Action','Events','Distinct trips']} rows={(Array.isArray(data.analytics?.activity?.daily)&&['ready','stale'].includes(data.analytics.activity.status)?data.analytics.activity.daily:[]).slice(0,45).map((row:Row)=>[label(row.day),label(row.action),label(row.eventCount),label(row.uniqueTripCount)])} empty="No accessible projection results (may be disabled, stale or missing)."/></section></div><section className={styles.panel}><p className={styles.overline}>LIVE DEMONSTRATION</p><h2>DBMS viva checklist</h2><div className={styles.checklist}><span>✓ MySQL relational schema and foreign keys</span><span>✓ JOIN, grouping and aggregate queries</span><span>✓ Views, procedure, function and triggers</span><span>✓ Transactional booking and concurrency</span><span>✓ MongoDB aggregation and synchronization status</span><span>✓ Versioned, auditable admin decisions</span></div><p className={styles.muted}>Explain which features are installed and which have been verified. This checklist describes code paths, not instructor approval or a live test pass.</p></section></>}
      </main>
    </div>
    {review && <div className={styles.modalBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!submitting)setReview(null);}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="reviewTitle"><p className={styles.overline}>AUDITABLE ADMINISTRATIVE CHANGE</p><h2 id="reviewTitle">{review.action.replaceAll('_',' ')} {review.kind} #{review.kind==='member'?review.row.user_id:review.row.id}?</h2><p>This operation is checked and committed by the backend. A reason is required, and an outdated record version will be rejected.</p><p className={styles.version}>Expected database version: {label(review.row.version)}</p><label>Reason for decision<textarea autoFocus maxLength={500} rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the decision for the audit trail…"/></label><div className={styles.modalActions}><button onClick={()=>setReview(null)} disabled={submitting}>Cancel</button><button className={styles.primary} disabled={submitting||!reason.trim()} onClick={decide}>{submitting?'Submitting…':'Confirm reviewed decision'}</button></div></section></div>}
  </div>;
}
