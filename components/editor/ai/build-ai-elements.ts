import type { EditorElement, TextRole } from "../core/editor-types";
import { clamp, makeId, pxToMm } from "../core/editor-utils";
import {
  getRoleLayoutConfig,
  fitFontSizeSmart,
} from "../core/editor-typography";
import {
  getLayoutPosition,
  getPositionXY,
  type LayoutPosition,
  type LayoutType,
} from "./layout-engine";

type BuildAiElementsParams = {
  data: any;
  widthMm: number;
  heightMm: number;
  previewCanvasWidth: number;
  previewCanvasHeight: number;
  previewSafe: number;
  layoutType: LayoutType;
};

function looksLikeContact(text: string) {
  return /(\+?\d[\d\s-]{5,})/.test(text);
}

function normalizeRole(rawRole: unknown, text: string): TextRole {
  const role = String(rawRole || "").toLowerCase();

  if (role === "headline" || role === "primary" || role === "title") {
    return "primary";
  }

  if (role === "subtitle" || role === "secondary") {
    return "secondary";
  }

  if (role === "contact" || role === "phone" || looksLikeContact(text)) {
    return "contact";
  }

  if (role === "cta" || role === "support" || role === "line") {
    return "support";
  }

  return text.length <= 28 ? "support" : "secondary";
}

function getTextName(role: TextRole) {
  if (role === "primary") return "Primary";
  if (role === "contact") return "Contact";
  if (role === "secondary") return "Secondary";
  return "Support";
}

function getInitialShadow(role: TextRole, layoutType: LayoutType) {
  if (role === "primary" && layoutType === "hero") {
    return "0 3px 12px rgba(0,0,0,0.22)";
  }

  if (role === "primary") {
    return "0 2px 10px rgba(0,0,0,0.18)";
  }

  return "0 1px 4px rgba(0,0,0,0.12)";
}

/**
 * Converts raw AI JSON into EditorElement objects.
 * This file should NOT do final design balancing.
 * Final layout decisions live in designer-layout.ts.
 */
export function buildAiElements({
  data,
  widthMm,
  heightMm,
  previewCanvasWidth,
  previewCanvasHeight,
  previewSafe,
  layoutType,
}: BuildAiElementsParams): EditorElement[] {
  const elements: EditorElement[] = [];

  if (typeof data?.image === "string" && data.image.trim()) {
    elements.push({
      id: makeId(),
      type: "logo",
      name: "AI BG",
      x: 0,
      y: 0,
      width: previewCanvasWidth,
      height: previewCanvasHeight,
      xMm: 0,
      yMm: 0,
      widthMm,
      heightMm,
      rotation: 0,
      opacity: 1,
      src: data.image,
      borderRadius: 0,
      aspectRatio: previewCanvasWidth / Math.max(previewCanvasHeight, 1),
    });
  }

  const texts: any[] = Array.isArray(data?.texts) ? data.texts : [];
  if (texts.length === 0) return elements;

  const safeLeft = previewSafe;
  const safeTop = previewSafe;
  const safeRight = previewCanvasWidth - previewSafe;
  const safeBottom = previewCanvasHeight - previewSafe;
  const safeWidth = Math.max(80, safeRight - safeLeft);

  texts.forEach((item) => {
    const text = String(item?.text || "").trim();
    if (!text) return;

    const role = normalizeRole(item?.role, text);
    const style = getRoleLayoutConfig(
      role,
      previewCanvasWidth,
      previewCanvasHeight,
    );

    const estimatedWidth = text.length * previewCanvasWidth * 0.018;
    const boxWidth = clamp(
      estimatedWidth,
      Math.min(260, safeWidth),
      safeWidth * 0.92,
    );

    const boxHeight = style.boxHeight;

    const position = getLayoutPosition(role, layoutType) as LayoutPosition;
    const placed = getPositionXY({
      position,
      boxWidth,
      boxHeight,
      safeLeft,
      safeTop,
      safeRight,
      safeBottom,
    });

    const fontSize = fitFontSizeSmart(
      text,
      role,
      boxWidth,
      boxHeight,
      previewCanvasWidth,
      previewCanvasHeight,
    );

    const color =
      typeof item?.color === "string" && item.color.trim()
        ? item.color.trim()
        : undefined;

    elements.push({
      id: makeId(),
      type: "text",
      name: getTextName(role),
      role,
      text,
      x: placed.x,
      y: placed.y,
      width: boxWidth,
      height: boxHeight,
      xMm: pxToMm(placed.x),
      yMm: pxToMm(placed.y),
      widthMm: pxToMm(boxWidth),
      heightMm: pxToMm(boxHeight),
      rotation: 0,
      opacity: 1,
      color: color,
      fontSize,
      fontScale: 1,
      fontWeight: style.fontWeight,
      fontFamily: "var(--font-inter), Inter, sans-serif",
      textAlign: placed.textAlign,
      lineHeight: style.lineHeight,
      borderRadius: 0,
      textShadow: getInitialShadow(role, layoutType),
      position,
    });
  });

  return elements;
}
