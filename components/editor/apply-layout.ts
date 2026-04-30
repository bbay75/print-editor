import type { EditorElement } from "./editor-types";
import type { LayoutType } from "./layout-engine";
import { buildAiElements } from "./build-ai-elements";
import { buildDesignerLayout } from "./designer-layout"; // 🔥 ЭНЭ НЭМ

type Params = {
  data: any;
  widthMm: number;
  heightMm: number;
  previewCanvasWidth: number;
  previewCanvasHeight: number;
  previewSafe: number;
  layoutType: LayoutType;
};

export function buildLayoutElements({
  data,
  widthMm,
  heightMm,
  previewCanvasWidth,
  previewCanvasHeight,
  previewSafe,
  layoutType,
}: Params): EditorElement[] {
  // 1️⃣ AI raw
  const ai = buildAiElements({
    data,
    widthMm,
    heightMm,
    previewCanvasWidth,
    previewCanvasHeight,
    previewSafe,
    layoutType,
  }) as EditorElement[];

  // 2️⃣ 🔥 DESIGNER FIX (хамгийн чухал)
  const fixed = buildDesignerLayout({
    elements: ai,
    type: layoutType,
    previewCanvasWidth,
    previewCanvasHeight,
    previewSafe,
  });

  return fixed;
}
