"use client";

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
  return (
    <label className="grid gap-1 text-sm">
      <span>
        {label}: {step < 1 ? value.toFixed(2) : Math.round(value)}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={onStart}
        onMouseDown={onStart}
        onTouchStart={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onPointerUp={onCommit}
      />
    </label>
  );
}
