"use client";

import React, { useRef, useState } from "react";
import type { EditorElement } from "../core/editor-types";
import FontPreviewDropdown from "../controls/FontPreviewDropdown";
import Range from "../controls/Range";
import SafeColorInput from "../controls/SafeColorInput";
import { AlignCenter, AlignLeft, AlignRight, Bold, Move, X } from "lucide-react";

type TextAlign = "left" | "center" | "right";

export default function SettingsPanel({
  selected,
  fontSizeControlMin,
  fontSizeControlMax,
  fontSizeControlStep,
  onStartEdit,
  onCommitEdit,
  onPatch,
  onClose,
  onFontChange,
  onTextAlignChange,
  onToggleBold,
  onFontSizeChange,
}: {
  selected: EditorElement;
  fontSizeControlMin: number;
  fontSizeControlMax: number;
  fontSizeControlStep: number;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onPatch: (patch: Partial<EditorElement>) => void;
  onClose: () => void;
  onFontChange: (fontFamily: string) => void;
  onTextAlignChange: (align: TextAlign) => void;
  onToggleBold: () => void;
  onFontSizeChange: (value: number) => void;
}) {
  const [settingsPos, setSettingsPos] = useState({ x: 980, y: 220 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: settingsPos.x,
      baseY: settingsPos.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setSettingsPos({
      x: dragRef.current.baseX + dx,
      y: dragRef.current.baseY + dy,
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      className="fixed z-[200] w-[300px] rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur"
      style={{ left: settingsPos.x, top: settingsPos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex cursor-move items-center justify-between rounded-t-3xl border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900"
      >
        <div className="inline-flex items-center gap-2">
          <Move className="h-4 w-4" />
          Тохиргоо
        </div>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          type="button"
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Хаах"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid gap-3">
          {(selected.type === "text" || selected.type === "line") && (
            <label className="grid gap-1 text-sm">
              <span>Өнгө</span>
              <SafeColorInput
                value={selected.color ?? "#0f172a"}
                onStart={onStartEdit}
                onChange={(value) => onPatch({ color: value })}
                onCommit={onCommitEdit}
              />
            </label>
          )}

          {selected.type === "text" && (
            <>
              <label className="grid gap-1 text-sm">
                <span>Фонт</span>
                <FontPreviewDropdown
                  value={
                    selected.fontFamily ?? "var(--font-inter), Inter, sans-serif"
                  }
                  onChange={onFontChange}
                />
              </label>

              <div className="mt-2 flex items-center gap-2">
                {[
                  { value: "left", icon: AlignLeft, label: "left" },
                  { value: "center", icon: AlignCenter, label: "center" },
                  { value: "right", icon: AlignRight, label: "right" },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => onTextAlignChange(value as TextAlign)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                      (selected.textAlign ?? "left") === value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    aria-label={label}
                    title={label}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}

                <button
                  onClick={onToggleBold}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                    (selected.fontWeight ?? 700) >= 700
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-label="bold"
                  title="bold"
                  type="button"
                >
                  <Bold className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3">
                <Range
                  label="Мөр хооронд зай"
                  value={selected.lineHeight ?? 1.2}
                  min={1}
                  max={2}
                  step={0.05}
                  onStart={onStartEdit}
                  onChange={(value) => onPatch({ lineHeight: value })}
                  onCommit={onCommitEdit}
                />
              </div>

              <Range
                label="Үсгийн хэмжээ (px)"
                value={selected.fontSize ?? 40}
                min={fontSizeControlMin}
                max={fontSizeControlMax}
                step={fontSizeControlStep}
                onStart={onStartEdit}
                onChange={onFontSizeChange}
                onCommit={onCommitEdit}
              />
            </>
          )}

          {selected.type === "line" && (
            <>
              <Range
                label="Шугамын урт"
                value={selected.width}
                min={80}
                max={900}
                onStart={onStartEdit}
                onChange={(value) => onPatch({ width: value })}
                onCommit={onCommitEdit}
              />
              <Range
                label="Шугамын зузаан"
                value={selected.lineThickness ?? 6}
                min={2}
                max={30}
                onStart={onStartEdit}
                onChange={(value) => onPatch({ lineThickness: value, height: value })}
                onCommit={onCommitEdit}
              />
            </>
          )}

          {selected.type === "logo" && (
            <Range
              label="Өргөн"
              value={selected.width}
              min={60}
              max={900}
              onStart={onStartEdit}
              onChange={(value) => onPatch({ width: value })}
              onCommit={onCommitEdit}
            />
          )}

          <Range
            label="Тунгалагшил"
            value={(selected.opacity ?? 1) * 100}
            min={0}
            max={100}
            step={1}
            onStart={onStartEdit}
            onChange={(value) => onPatch({ opacity: value / 100 })}
            onCommit={onCommitEdit}
          />
        </div>
      </div>
    </div>
  );
}
