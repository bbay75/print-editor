import type { EditorElement } from "../core/editor-types";
import { mmToPx } from "../core/editor-utils";

export function getElementX(element: EditorElement) {
  return typeof element.xMm === "number" ? mmToPx(element.xMm) : element.x;
}

export function getElementY(element: EditorElement) {
  return typeof element.yMm === "number" ? mmToPx(element.yMm) : element.y;
}

export function getElementWidth(element: EditorElement) {
  return typeof element.widthMm === "number"
    ? mmToPx(element.widthMm)
    : element.width;
}

export function getStoredElementHeight(element: EditorElement) {
  return typeof element.heightMm === "number"
    ? mmToPx(element.heightMm)
    : element.height;
}

/**
 * Text height is NOT a source of truth anymore.
 * Text is rendered by the DOM in TextItem. This helper is only a fallback
 * for moments where the DOM node is not available yet.
 */
export function estimateTextVisualHeight(element: EditorElement) {
  const fontSize = (element.fontSize ?? 40) * (element.fontScale ?? 1);
  const lineHeight = Math.max(element.lineHeight ?? 1.2, 1);
  const width = Math.max(20, getElementWidth(element));
  const text = element.text ?? "";

  const avgCharWidth = Math.max(6, fontSize * 0.55);
  const charsPerLine = Math.max(1, Math.floor(width / avgCharWidth));

  const rawLines = text.length ? text.split("\n") : [""];
  const visualLines = rawLines.reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);

  return Math.ceil(fontSize * lineHeight * Math.max(1, visualLines));
}

export function getElementVisualHeight(element: EditorElement) {
  if (element.type === "text") {
    return estimateTextVisualHeight(element);
  }

  return getStoredElementHeight(element);
}
