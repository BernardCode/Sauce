"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    window.localStorage.setItem("daylight-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
    >
      <Moon className="theme-moon" size={17} />
      <Sun className="theme-sun" size={17} />
    </button>
  );
}
