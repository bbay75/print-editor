"use client";

import { useEffect, useState } from "react";

export default function SafeColorInput({
  value,
  onChange,
  onCommit,
  onStart,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  onStart?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-11 w-full rounded-xl border border-slate-200 bg-white" />
    );
  }

  return (
    <input
      type="color"
      value={value}
      onPointerDown={onStart}
      onMouseDown={onStart}
      onFocus={onStart}
      onChange={(e) => {
        onChange(e.target.value);
        onCommit?.();
      }}
      onBlur={onCommit}
      className="h-11 w-full rounded-xl border border-slate-200 p-1"
      suppressHydrationWarning
    />
  );
}
