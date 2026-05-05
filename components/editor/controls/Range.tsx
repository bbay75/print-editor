"use client";

import { useRef } from "react";

export default function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  onStart,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  onStart?: () => void;
}) {
  const isDraggingRef = useRef(false);
  const showNumberInput = label.includes("Үсгийн хэмжээ");

  const clampValue = (next: number) => {
    if (!Number.isFinite(next)) return value;
    return Math.min(max, Math.max(min, next));
  };

  const finishDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    onCommit?.();
  };

  return (
    <label
      className="grid gap-1 text-sm"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span>
          {label}: {step < 1 ? value.toFixed(2) : Math.round(value)}
        </span>

        {showNumberInput && (
          <input
            type="number"
            value={Math.round(value)}
            min={min}
            max={max}
            step={step}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStart?.();
            }}
            onChange={(e) => {
              onChange(clampValue(Number(e.currentTarget.value)));
            }}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 pr-1 text-center text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
          />
        )}
      </div>

      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture?.(e.pointerId);

          if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            onStart?.();
          }
        }}
        onChange={(e) => {
          e.stopPropagation();
          onChange(Number(e.currentTarget.value));
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          finishDrag();
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          finishDrag();
        }}
        onBlur={finishDrag}
      />
    </label>
  );
}
