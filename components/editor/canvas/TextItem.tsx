"use client";

import React from "react";
import type { EditorElement } from "../core/editor-types";

export default function TextItem({
  element,
  scale,
  color,
  textShadow,
}: {
  element: EditorElement;
  scale: number;
  color: string;
  textShadow: string;
  onSelect: () => void;
  onPatch: (patch: Partial<EditorElement>) => void;
  onCommit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const fontSize = (element.fontSize ?? 40) * (element.fontScale ?? 1);
  const lineHeight = Math.max(element.lineHeight ?? 1.2, 1);

  return (
    <div
      data-editor-visible-text="true"
      style={{
        color,
        fontSize: `${fontSize * scale}px`,
        fontWeight: element.fontWeight ?? 400,
        fontFamily:
          element.fontFamily ?? "var(--font-inter), Inter, sans-serif",
        textAlign: element.textAlign ?? "left",
        lineHeight,
        textShadow,
        background: "transparent",
        padding: 0,
        margin: 0,
        border: "none",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        width: "100%",
        height: "auto",
        minHeight: 0,
        maxHeight: "none",
        display: "block",
        boxSizing: "border-box",
        overflow: "visible",
        overflowX: "visible",
        overflowY: "visible",
        pointerEvents: "none",
        cursor: "move",
        userSelect: "none",
      }}
    >
      {element.text ?? ""}
    </div>
  );
}
