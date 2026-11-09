// Dev role switcher (Auth NOT built yet, no password).
// Drop into the App.tsx top bar. Persists to localStorage ("devRole") and
// sends X-Dev-Role on every API call (see frontend/src/api/*) or ?devRole=.
import React from "react";

export const DEV_ROLE_OPTIONS = [
  "System",
  "Super Admin",
  "Admin",
  "Author",
  "Approver/Reviewer",
  "Project Manager",
  "People Manager",
  "View",
  "Temp View",
] as const;

export function getDevRole(): string {
  return localStorage.getItem("devRole") || "Author";
}

export function devRoleHeaders(): Record<string, string> {
  return { "X-Dev-Role": getDevRole() };
}

export function withDevRole(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}devRole=${encodeURIComponent(getDevRole())}`;
}

export default function DevRoleSwitcher() {
  const [role, setRole] = React.useState<string>(getDevRole());
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRole(e.target.value);
    localStorage.setItem("devRole", e.target.value);
    window.location.reload();
  };
  return (
    <label data-testid="dev-role-switcher" style={{ marginLeft: 12 }}>
      Role{" "}
      <select data-testid="dev-role-select" value={role} onChange={onChange}>
        {DEV_ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </label>
  );
}
