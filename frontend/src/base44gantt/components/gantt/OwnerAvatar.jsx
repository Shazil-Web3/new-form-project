import React from "react";

const AVATAR_COLORS = [
  "bg-rose-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500",
  "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
  "bg-teal-500", "bg-orange-500"
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

export default function OwnerAvatar({ name, image, size = 24, className = "", ring = true }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || "owner"}
        className={`rounded-full object-cover shrink-0 ${ring ? "ring-1 ring-white/20" : ""} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const color = AVATAR_COLORS[hash(name || "?") % AVATAR_COLORS.length];
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${color} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.38) }}
    >
      {getInitials(name)}
    </div>
  );
}