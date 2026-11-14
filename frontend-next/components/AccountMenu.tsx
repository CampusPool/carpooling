"use client";

import { useEffect, useRef } from "react";
import styles from "./AccountMenu.module.css";

export default function AccountMenu({ name, email, busy, onSettings, onSignOut }: {
  name: string; email: string; busy: boolean; onSettings: () => void; onSignOut: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "C";

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && menu.current) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function choose(action: () => void) {
    if (menu.current) menu.current.open = false;
    action();
  }

  return <details className={styles.menu} ref={menu}>
    <summary aria-label="Account menu" title="Your account">{initials}</summary>
    <div className={styles.panel}>
      <strong>{name}</strong>
      <span>{email}</span>
      <button type="button" onClick={() => choose(onSettings)}>Profile &amp; settings</button>
      <button type="button" disabled={busy} onClick={() => choose(onSignOut)}>Sign out</button>
    </div>
  </details>;
}
