"use client";

import React from "react";
import type { EditorElement } from "../core/editor-types";

export default function ImageItem({
  element,
  bgImageRef,
}: {
  element: EditorElement;
  bgImageRef: React.RefObject<HTMLImageElement | null>;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={element.name === "AI BG" ? bgImageRef : null}
      src={element.src}
      alt={element.name}
      crossOrigin="anonymous"
      className={`h-full w-full ${element.name === "AI BG" ? "object-cover scale-[1.03]" : "object-contain"}`}
      style={{ borderRadius: element.borderRadius, userSelect: "none", pointerEvents: "none" }}
    />
  );
}
