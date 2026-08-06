"use client";

import { useRef, useState, type DragEvent } from "react";
import { dropzone } from "@/lib/wizard-ui";

export function FileDropzone({
  title,
  hint,
  loadingLabel,
  onFile,
}: {
  title: string;
  hint: string;
  loadingLabel: string;
  onFile: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato yuz berdi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          ...dropzone,
          borderColor: dragging ? "var(--accent)" : "var(--border)",
          background: dragging ? "var(--accent-soft)" : "var(--surface-2)",
          opacity: busy ? 0.7 : 1,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
      >
        <div style={{ fontSize: 22, marginBottom: 8 }}>📄</div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{busy ? loadingLabel : title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{hint}</div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.pdf,.csv,.txt"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--danger)" }}>⚠ {error}</div>
      )}
    </div>
  );
}
