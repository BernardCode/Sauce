"use client";

import { useEffect } from "react";
import { alertStorageKey, defaultAlertPreferences, type AlertPreferences } from "@/app/settings/notification-preferences";

export function SmartAlerts({ overdue, nextBlockStart, nextBlockTitle, atRisk }: { overdue: number; nextBlockStart: string | null; nextBlockTitle: string | null; atRisk: number }) {
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    let preferences = defaultAlertPreferences;
    try { const stored = localStorage.getItem(alertStorageKey); if (stored) preferences = { ...preferences, ...JSON.parse(stored) as AlertPreferences }; } catch {}
    const day = new Date().toISOString().slice(0, 10);
    function notifyOnce(key: string, title: string, body: string) { const storageKey = `daylight-alert:${day}:${key}`; if (sessionStorage.getItem(storageKey)) return; new Notification(title, { body, tag: storageKey }); sessionStorage.setItem(storageKey, "sent"); }
    if (preferences.deadlines && overdue > 0) notifyOnce("overdue", "Assignments need attention", `${overdue} ${overdue === 1 ? "assignment is" : "assignments are"} overdue.`);
    if (preferences.risk && atRisk > 0) notifyOnce("risk", "A project is at risk", "Open Daylight to rescue the plan before the deadline.");
    if (preferences.blocks && nextBlockStart && nextBlockTitle) { const minutes = (new Date(nextBlockStart).getTime() - Date.now()) / 60_000; if (minutes >= 0 && minutes <= 10) notifyOnce(`block:${nextBlockStart}`, "Study block starting soon", `${nextBlockTitle} starts in ${Math.ceil(minutes)} minutes.`); }
  }, [atRisk, nextBlockStart, nextBlockTitle, overdue]);
  return null;
}
