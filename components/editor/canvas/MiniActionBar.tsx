"use client";

import React from "react";
import { Move, Trash2 } from "lucide-react";
import type { ElementType } from "../core/editor-types";

export default function MiniActionBar({
  type,
  onDelete,
  showMoveHandle,
  onMovePointerDown,
}: {
  type: ElementType;
  onDelete: () => void;
  showMoveHandle?: boolean;
  onMovePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="absolute -top-11 left-0 z-20 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur">
      <span>{type === "text" ? "Текст" : type === "logo" ? "Лого" : "Шугам"}</span>
      {showMoveHandle && onMovePointerDown && (
        <>
          <span className="h-4 w-px bg-slate-200" />
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMovePointerDown(e);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-700 hover:bg-slate-100"
          >
            <Move className="h-3.5 w-3.5" />
            Зөөх
          </button>
        </>
      )}
      <span className="h-4 w-px bg-slate-200" />
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Устгах
      </button>
    </div>
  );
}
