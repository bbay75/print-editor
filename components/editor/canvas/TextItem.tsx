"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import type { EditorElement } from "../core/editor-types";

export default function TextItem({
  element,
  scale,
  color,
  textShadow,
  onSelect,
  onPatch,
  onCommit,
  onDragStart,
  onDragEnd,
}: {
  element: EditorElement;
  scale: number;
  color?: string;
  textShadow: string;
  onSelect: () => void;
  onPatch: (patch: Partial<EditorElement>) => void;
  onCommit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const fontSize = (element.fontSize ?? 40) * (element.fontScale ?? 1);
  const lineHeight = Math.max(element.lineHeight ?? 1.2, 1);

  const computedShadow =
    element.role === "primary"
      ? "0 2px 4px rgba(0,0,0,0.22), 0 8px 18px rgba(0,0,0,0.14)"
      : element.role === "contact"
        ? "0 1px 3px rgba(0,0,0,0.16), 0 4px 10px rgba(0,0,0,0.08)"
        : "0 1px 3px rgba(0,0,0,0.18), 0 5px 12px rgba(0,0,0,0.10)";

  const [textHeight, setTextHeight] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const nextHeight = el.scrollHeight;
    el.style.height = `${nextHeight}px`;
    setTextHeight(nextHeight);
  }, [
    element.text,
    fontSize,
    lineHeight,
    scale,
    element.width,
    element.textAlign,
  ]);
  return (
    <textarea
      ref={textareaRef}
      rows={1}
      data-editor-visible-text="true"
      value={element.text ?? ""}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onFocus={() => {
        onSelect();
        onDragStart();
      }}
      onChange={(e) => {
        onPatch({ text: e.target.value });
      }}
      onBlur={() => {
        onCommit();
        onDragEnd();
      }}
      style={{
        color: color,
        opacity: element.opacity ?? 1,
        pointerEvents: (element as any).isEditing ? "auto" : "none",
        fontSize: `${fontSize * scale}px`,
        fontWeight: element.fontWeight ?? 400,
        fontFamily:
          element.fontFamily ?? "var(--font-inter), Inter, sans-serif",
        textAlign: element.textAlign ?? "left",
        lineHeight,
        textShadow: computedShadow,
        background: "transparent",
        padding: 0,
        margin: 0,
        border: "none",
        outline: "none",
        resize: "none",
        whiteSpace: "pre-line",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        width: "100%",
        height: textHeight > 0 ? `${textHeight}px` : "auto",
        overflow: "hidden",
        boxSizing: "border-box",
        display: "block",
        verticalAlign: "top",
      }}
    />
  );
}
