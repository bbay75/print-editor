"use client";

import React from "react";
import { Move, Type, Image, Minus } from "lucide-react";
import type { ElementType } from "../core/editor-types";

export default function MiniActionBar({
  type,
  showMoveHandle,
  onMovePointerDown,
}: {
  type: ElementType;
  onDelete: () => void;
  showMoveHandle?: boolean;
  onMovePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const TypeIcon = type === "text" ? Type : type === "logo" ? Image : Minus;

  return (
    <div className="absolute -top-11 left-1/2 z-[999999] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-slate-200 bg-white/90 px-1.5 py-1 text-xs font-semibold text-slate-700 shadow-md backdrop-blur">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full"
        title={type === "text" ? "Текст" : type === "logo" ? "Лого" : "Шугам"}
      >
        <TypeIcon className="h-3.5 w-3.5" />
      </span>

      {showMoveHandle && onMovePointerDown && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMovePointerDown(e);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
          title="Зөөх"
        >
          <Move className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
