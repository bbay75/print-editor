"use client";

import React, { useRef, useState } from "react";
import type { EditorElement } from "../core/editor-types";
import FontPreviewDropdown from "../controls/FontPreviewDropdown";
import Range from "../controls/Range";
import SafeColorInput from "../controls/SafeColorInput";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Move,
  X,
} from "lucide-react";

type TextAlign = "left" | "center" | "right";
type TabType =
  | "none"
  | "color"
  | "font"
  | "spacing"
  | "size"
  | "opacity"
  | "line";

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
  const [activeTab, setActiveTab] = useState<TabType>("none");

  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
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

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    setSettingsPos({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const toggleTab = (tab: TabType) => {
    setActiveTab((prev) => (prev === tab ? "none" : tab));
  };

  const chipClass = (tab: TabType) =>
    `h-8 shrink-0 rounded-xl border px-3 text-[11px] font-semibold ${
      activeTab === tab
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-200 bg-white text-slate-700"
    }`;

  const iconButtonClass = (active: boolean) =>
    `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
      active
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-200 bg-white text-slate-700"
    }`;

  const alignButtons = (
    <div className="flex items-center gap-1">
      {[
        { value: "left", icon: AlignLeft, label: "left" },
        { value: "center", icon: AlignCenter, label: "center" },
        { value: "right", icon: AlignRight, label: "right" },
      ].map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onTextAlignChange(value as TextAlign)}
          className={iconButtonClass((selected.textAlign ?? "left") === value)}
          aria-label={label}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}

      <button
        type="button"
        onClick={onToggleBold}
        className={iconButtonClass((selected.fontWeight ?? 700) >= 700)}
        aria-label="bold"
        title="bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const desktopPanelContent = (
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

          {alignButtons}

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
            onChange={(value) =>
              onPatch({
                lineThickness: value,
                height: value,
              })
            }
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
  );

  return (
    <>
      {/* MOBILE: compact 2-row toolbar */}
      <div
        className="fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[200] md:hidden"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-[420px] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
          {/* Row 1 */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {selected.type === "text" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("size"); // 👈 ЭНЭ НЭМ
                    onFontSizeChange(
                      Math.max(
                        fontSizeControlMin,
                        (selected.fontSize ?? 40) - fontSizeControlStep,
                      ),
                    );
                  }}
                  className="h-8 w-8 shrink-0 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                >
                  −
                </button>

                <button
                  type="button"
                  onClick={() => toggleTab("size")}
                  className={chipClass("size")}
                >
                  {selected.fontSize ?? 40}px
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("size"); // 👈 ЭНЭ НЭМ
                    onFontSizeChange(
                      Math.min(
                        fontSizeControlMax,
                        (selected.fontSize ?? 40) + fontSizeControlStep,
                      ),
                    );
                  }}
                  className="h-8 w-8 shrink-0 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                >
                  +
                </button>

                <div className="ml-auto flex items-center gap-1">
                  {alignButtons}
                </div>
              </>
            )}
          </div>

          {/* Row 2 */}
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {(selected.type === "text" || selected.type === "line") && (
              <button
                type="button"
                onClick={() => toggleTab("color")}
                className={chipClass("color")}
              >
                Өнгө
              </button>
            )}

            {selected.type === "text" && (
              <>
                <button
                  type="button"
                  onClick={() => toggleTab("font")}
                  className={chipClass("font")}
                >
                  Фонт
                </button>

                <button
                  type="button"
                  onClick={() => toggleTab("spacing")}
                  className={chipClass("spacing")}
                >
                  Мөр
                </button>
              </>
            )}

            {selected.type === "line" && (
              <button
                type="button"
                onClick={() => toggleTab("line")}
                className={chipClass("line")}
              >
                Шугам
              </button>
            )}

            {selected.type === "logo" && (
              <button
                type="button"
                onClick={() => toggleTab("size")}
                className={chipClass("size")}
              >
                Өргөн
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleTab("opacity")}
              className={chipClass("opacity")}
            >
              Ил тод
            </button>
          </div>

          {activeTab !== "none" && (
            <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2">
              {activeTab === "color" &&
                (selected.type === "text" || selected.type === "line") && (
                  <SafeColorInput
                    value={selected.color ?? "#0f172a"}
                    onStart={onStartEdit}
                    onChange={(value) => onPatch({ color: value })}
                    onCommit={onCommitEdit}
                  />
                )}

              {activeTab === "font" && selected.type === "text" && (
                <FontPreviewDropdown
                  value={
                    selected.fontFamily ??
                    "var(--font-inter), Inter, sans-serif"
                  }
                  onChange={onFontChange}
                />
              )}

              {activeTab === "spacing" && selected.type === "text" && (
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
              )}

              {activeTab === "size" && selected.type === "text" && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Үсгийн хэмжээ
                    </span>

                    <input
                      type="number"
                      value={selected.fontSize ?? 40}
                      min={fontSizeControlMin}
                      max={fontSizeControlMax}
                      step={fontSizeControlStep}
                      onFocus={onStartEdit}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isNaN(value)) return;

                        onFontSizeChange(
                          Math.max(
                            fontSizeControlMin,
                            Math.min(fontSizeControlMax, value),
                          ),
                        );
                      }}
                      onBlur={onCommitEdit}
                      className="h-8 w-20 rounded-xl border border-slate-200 bg-white px-2 text-right text-xs font-semibold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>

                  <input
                    type="range"
                    value={selected.fontSize ?? 40}
                    min={fontSizeControlMin}
                    max={fontSizeControlMax}
                    step={fontSizeControlStep}
                    onPointerDown={onStartEdit}
                    onChange={(e) => onFontSizeChange(Number(e.target.value))}
                    onPointerUp={onCommitEdit}
                    className="w-full"
                  />
                </div>
              )}

              {activeTab === "line" && selected.type === "line" && (
                <div className="grid gap-2">
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
                    onChange={(value) =>
                      onPatch({
                        lineThickness: value,
                        height: value,
                      })
                    }
                    onCommit={onCommitEdit}
                  />
                </div>
              )}

              {activeTab === "opacity" && (
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP: old draggable panel */}
      <div
        className="hidden fixed z-[200] w-[300px] rounded-2xl border border-slate-200 bg-white shadow-2xl md:block"
        style={{ left: settingsPos.x, top: settingsPos.y }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          className="flex cursor-move items-center justify-between rounded-t-2xl border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900"
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

        <div className="p-4">{desktopPanelContent}</div>
      </div>
    </>
  );
}
