"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";

export type AlertPreferences = { deadlines: boolean; blocks: boolean; risk: boolean };
export const defaultAlertPreferences: AlertPreferences = { deadlines: true, blocks: true, risk: true };
export const alertStorageKey = "daylight-alert-preferences";

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState(defaultAlertPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const stored = localStorage.getItem(alertStorageKey); if (stored) setPreferences({ ...defaultAlertPreferences, ...JSON.parse(stored) as AlertPreferences }); } catch {}
      setPermission("Notification" in window ? Notification.permission : "unsupported");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function update(key: keyof AlertPreferences, value: boolean) { const next = { ...preferences, [key]: value }; setPreferences(next); localStorage.setItem(alertStorageKey, JSON.stringify(next)); }
  async function enable() { if (!("Notification" in window)) return; setPermission(await Notification.requestPermission()); }
  return (
    <section className="workspace-card motion-settings-section"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><BellRing size={18} className="text-amber-500" /><h2 className="font-semibold">Careful alerts</h2></div><p className="mt-1 text-sm text-[var(--muted)]">Only urgent deadlines, starting work blocks, and at-risk projects. Device alerts run while Daylight is open.</p></div>{permission !== "granted" && permission !== "unsupported" ? <button type="button" onClick={() => void enable()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"><Bell size={15} />Enable device alerts</button> : <span className="rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{permission === "granted" ? "Device alerts enabled" : "In-app alerts only"}</span>}</div><div className="mt-4 grid gap-3 sm:grid-cols-3">{([['deadlines', 'Urgent deadlines', 'Overdue or due within 24 hours'], ['blocks', 'Starting blocks', 'A planned session starts within 10 minutes'], ['risk', 'At-risk projects', 'Remaining work no longer fits']] as const).map(([key, title, copy]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3"><input type="checkbox" checked={preferences[key]} onChange={(event) => update(key, event.target.checked)} className="mt-1 accent-[var(--primary)]" /><span><strong className="block text-sm">{title}</strong><small className="mt-1 block text-xs leading-5 text-[var(--muted)]">{copy}</small></span></label>)}</div></section>
  );
}
