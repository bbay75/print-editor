import { EditorElement } from "./editor-types";
import { pxToMm, makeId, fitFontSize } from "./editor-utils";
export function createTextElement(
  canvasWidth: number,
  text = "Шинэ текст",
  x = 140,
  y = 140,
): EditorElement {
  const fontSize = fitFontSize(text);
  return {
    id: makeId(),
    type: "text",
    name: "Текст",
    x,
    y,
    width: Math.min(canvasWidth * 0.8, 760),
    height: 0,
    xMm: pxToMm(x),
    yMm: pxToMm(y),
    widthMm: pxToMm(Math.min(canvasWidth * 0.8, 760)),
    heightMm: undefined,
    rotation: 0,
    opacity: 1,
    color: "#0f172a",
    text,
    fontSize,
    fontScale: 1,
    fontWeight: 700,
    borderRadius: 0,
    fontFamily: "var(--font-inter), Inter, sans-serif",
    textAlign: "center",
    lineHeight: 1.1,
  };
}

export function createLineElement(): EditorElement {
  return {
    id: makeId(),
    type: "line",
    name: "Шугам",
    x: 180,
    y: 420,
    width: 420,
    height: 6,
    xMm: pxToMm(180),
    yMm: pxToMm(420),
    widthMm: pxToMm(420),
    heightMm: pxToMm(6),
    rotation: 0,
    opacity: 1,
    color: "#0f172a",
    lineThickness: 6,
    borderRadius: 999,
  };
}
