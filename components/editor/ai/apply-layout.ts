import type { EditorElement } from "../core/editor-types";
import type { LayoutType } from "./layout-engine";
import { buildAiElements } from "./build-ai-elements";
import { buildDesignerLayout } from "./designer-layout";

type Params = {
  data: any;
  widthMm: number;
  heightMm: number;
  previewCanvasWidth: number;
  previewCanvasHeight: number;
  previewSafe: number;
  layoutType: LayoutType;
};

/**
 * AI response -> clean canvas elements.
 *
 * Flow is intentionally only 2 steps:
 * 1. buildAiElements: normalize raw AI JSON into rough EditorElement objects
 * 2. buildDesignerLayout: final visual layout, spacing, font sizing, safe area
 */
export function buildLayoutElements(params: Params): EditorElement[] {
  const rawElements = buildAiElements(params);

  return buildDesignerLayout({
    elements: rawElements,
    type: params.layoutType,
    previewCanvasWidth: params.previewCanvasWidth,
    previewCanvasHeight: params.previewCanvasHeight,
    previewSafe: params.previewSafe,
  });
}
