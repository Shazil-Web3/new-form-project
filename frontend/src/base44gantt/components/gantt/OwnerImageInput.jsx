import React, { useState } from "react";
import { base44 } from "../../base44Client";
import OwnerAvatar from "./OwnerAvatar";

export default function OwnerImageInput({ name, value, onChange, size = 40 }) {
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onChange(file_url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <OwnerAvatar name={name} image={value} size={size} />
      <label className="cursor-pointer text-xs text-slate-300 border border-white/10 rounded px-2 py-1 hover:border-white/20 transition-colors">
        {busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}
        <input type="file" accept="image/*" className="hidden" onChange={handle} disabled={busy} />
      </label>
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-xs text-rose-400 hover:text-rose-300">
          Remove
        </button>
      )}
    </div>
  );
}