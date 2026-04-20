// lib/editor-utils.ts

import { EditorElement, PresetDefinition } from "./editor-types";

const mmToPx = (mm: number) => mm * 3.7795;
const pxToMm = (px: number) => px * 0.264583;

const newId = () => Math.random().toString(36).slice(2, 10);

// ============================
// PRESETS (PRINT BASED)
// ============================

export const PRESETS: PresetDefinition[] = [
  {
    id: "business-card",
    name: "Business Card",
    widthMm: 90,
    heightMm: 50,
    bleedMm: 3,
    safeMm: 5,
  },
  {
    id: "post",
    name: "Post",
    widthMm: 1080,
    heightMm: 1080,
    bleedMm: 0,
    safeMm: 40,
  },
  {
    id: "poster",
    name: "Poster",
    widthMm: 500,
    heightMm: 700,
    bleedMm: 5,
    safeMm: 20,
  },
  {
    id: "banner",
    name: "Banner",
    widthMm: 3000,
    heightMm: 1000,
    bleedMm: 10,
    safeMm: 40,
  },
];

// ============================
// ELEMENT FACTORIES
// ============================

export function createTextElementMM(
  text = "Шинэ текст",
  xMm = 50,
  yMm = 50,
): EditorElement {
  const widthMm = 200;
  const heightMm = 60;

  return {
    id: newId(),
    type: "text",
    name: "Текст",

    xMm,
    yMm,
    widthMm,
    heightMm,

    x: mmToPx(xMm),
    y: mmToPx(yMm),
    width: mmToPx(widthMm),
    height: mmToPx(heightMm),

    rotation: 0,
    opacity: 1,

    text,
    color: "#0f172a",
    fontSize: 48,
    fontWeight: 700,
    fontFamily: "var(--font-inter), Inter, sans-serif",
    textAlign: "left",
    lineHeight: 1.2,
  };
}

export function createLogoElementMM(
  src: string,
  xMm = 50,
  yMm = 50,
): EditorElement {
  const widthMm = 120;
  const heightMm = 120;

  return {
    id: newId(),
    type: "logo",
    name: "Лого",

    xMm,
    yMm,
    widthMm,
    heightMm,

    x: mmToPx(xMm),
    y: mmToPx(yMm),
    width: mmToPx(widthMm),
    height: mmToPx(heightMm),

    rotation: 0,
    opacity: 1,

    src,
    aspectRatio: 1,
  };
}

export function createLineElementMM(xMm = 50, yMm = 100): EditorElement {
  const widthMm = 200;
  const thicknessMm = 3;

  return {
    id: newId(),
    type: "line",
    name: "Шугам",

    xMm,
    yMm,
    widthMm,
    heightMm: thicknessMm,

    x: mmToPx(xMm),
    y: mmToPx(yMm),
    width: mmToPx(widthMm),
    height: mmToPx(thicknessMm),

    rotation: 0,
    opacity: 1,

    color: "#0f172a",
    lineThickness: mmToPx(thicknessMm),
  };
}

// ============================
// PRESET APPLY
// ============================

export function applyPreset(preset: PresetDefinition) {
  return {
    doc: {
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      bleedMm: preset.bleedMm,
      safeMm: preset.safeMm,
    },
    elements: [] as EditorElement[],
  };
}

// ============================
// SIMPLE AI LAYOUT BASE
// ============================

export function simpleLayout(elements: EditorElement[]) {
  let currentY = 60;

  return elements.map((el) => {
    const updated = {
      ...el,
      xMm: 60,
      yMm: currentY,
    };

    currentY += (el.heightMm ?? 60) + 20;

    return {
      ...updated,
      x: mmToPx(updated.xMm!),
      y: mmToPx(updated.yMm!),
    };
  });
}
