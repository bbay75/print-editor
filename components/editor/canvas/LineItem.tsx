"use client";

import React from "react";
import type { EditorElement } from "../core/editor-types";

export default function LineItem({ element, scale, logicalH }: { element: EditorElement; scale: number; logicalH: number }) {
  return (
    <div className="flex h-full w-full items-center">
      <div
        className="w-full"
        style={{ height: (element.lineThickness ?? logicalH ?? 6) * scale, background: element.color, borderRadius: 999 }}
      />
    </div>
  );
}
