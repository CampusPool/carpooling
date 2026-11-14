"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./RideConversation.module.css";

type Message = { id: number; user_id: number; text: string; created_at: string };
type Participant = { id: number; name: string };

async function api(token: string, tripId: number, path: string, body?: unknown, key?: string) {
  const response = await fetch(`/api/mobility/trips/${tripId}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key || crypto.randomUUID() }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.message || result?.error?.code?.replaceAll("_", " ") || "The ride could not be updated. Please try again.");
  return result.data ?? result;
}

export default function RideConversation({ token, tripId }: { token: string; tripId: number; isDriver: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const generation = useRef(0);
  const sendKey = useRef<{ text: string; key: string } | null>(null);

  useEffect(() => {
    const current = ++generation.current;
    let stopped = false;
    let refreshing = false;
    setMessages([]); setParticipants([]); setCanSend(false); setDraft(""); setChatError(""); setSending(false);
    sendKey.current = null;
    async function refresh() {
      if (refreshing || stopped) return;
      refreshing = true;
      try {
        const data = await api(token, tripId, "messages");
        if (stopped || generation.current !== current) return;
        setMessages(data.messages || []); setParticipants(data.participants || []); setCanSend(data.can_send === true); setChatError("");
        const last = data.messages?.at(-1)?.id;
        if (last) void api(token, tripId, "messages/read", { through_id: last }).catch(() => {});
      } catch (error) {
        if (!stopped && generation.current === current) { setChatError((error as Error).message); setCanSend(false); }
      } finally { refreshing = false; }
    }
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => { stopped = true; generation.current++; clearInterval(timer); };
  }, [token, tripId]);

  async function send(event: FormEvent) {
    event.preventDefault(); const text = draft.trim();
    if (!text || !canSend || sending) return;
    const current = generation.current;
    const key = sendKey.current?.text === text ? sendKey.current.key : crypto.randomUUID();
    sendKey.current = { text, key }; setSending(true); setChatError("");
    try {
      const message = await api(token, tripId, "messages", { text }, key);
      if (generation.current !== current) return;
      setMessages((rows) => [...rows.filter((row) => row.id !== message.id), message]); setDraft(""); sendKey.current = null;
    } catch (error) { if (generation.current === current) setChatError((error as Error).message); }
    finally { if (generation.current === current) setSending(false); }
  }

  return <section className={styles.panel} aria-label={`Ride ${tripId} conversation`}>
    <div className={styles.header}><div><small>YOUR CONFIRMED RIDE</small><h3>Chat and meet up</h3></div><span>Ride #{tripId}</span></div>
    <div className={styles.messages} role="log" aria-label="Ride messages" aria-live="polite">
      {!messages.length && <p>Send a message to arrange your pickup.</p>}
      {messages.map((message) => <div className={styles.message} key={message.id}><strong>{participants.find((person) => person.id === message.user_id)?.name || "Ride participant"}</strong><p>{message.text}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</time></div>)}
    </div>
    {chatError && <p role="alert">{chatError}</p>}
    <form className={styles.composer} onSubmit={send}><label className={styles.inputLabel}>Message<input value={draft} maxLength={800} onChange={(event) => setDraft(event.target.value)} placeholder="Where should we meet?" disabled={!canSend || sending} /></label><button disabled={!canSend || sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button></form>
    {!canSend && !chatError && <small>Chat is available to the driver and confirmed riders while the ride is open.</small>}
  </section>;
}
