"use client";

import React, { useEffect, useRef } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [element.text, fontSize, lineHeight, scale, element.width]);
  return (
    <textarea
      ref={textareaRef}
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
        outline: "none",
        resize: "none",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        width: "100%",
        height: "auto",
        minHeight: `${fontSize * lineHeight * scale}px`,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    />
  );
}
