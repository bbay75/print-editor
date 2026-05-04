"use client";

import CanvasItem from "./CanvasItem";
import type { EditorElement } from "../core/editor-types";

export default function CanvasStage({
  elements,
  selectedId,
  scale,
  docWidth,
  docHeight,
  previewBleed,
  previewSafe,
  onSelect,
  onDelete,
  onPatch,
  onCommit,
  onDragStart,
  onDragEnd,
  onGuidesChange,
}: {
  elements: EditorElement[];
  selectedId: string | null;
  scale: number;
  docWidth: number;
  docHeight: number;
  previewBleed: number;
  previewSafe: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<EditorElement>) => void;
  onCommit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onGuidesChange: (guides: {
    vertical: number | null;
    horizontal: number | null;
  }) => void;
}) {
  return (
    <>
      {(Array.isArray(elements) ? elements : []).map((item) => (
        <CanvasItem
          key={item.id}
          element={item}
          scale={scale}
          selected={item.id === selectedId}
          docWidth={docWidth}
          docHeight={docHeight}
          previewBleed={previewBleed}
          previewSafe={previewSafe}
          onSelect={() => onSelect(item.id)}
          onDelete={() => onDelete(item.id)}
          onPatch={(patch) => onPatch(item.id, patch)}
          onCommit={onCommit}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onGuidesChange={onGuidesChange}
        />
      ))}
    </>
  );
}
