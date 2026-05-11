import type { EditorElement, TextRole } from "../core/editor-types";
import { cloneElements } from "../core/editor-history";
import { clamp, pxToMm } from "../core/editor-utils";
import {
  getRoleLayoutConfig,
  measureTextHeightForFont,
} from "../core/editor-typography";
import type { LayoutType } from "./layout-engine";

const ROLE_ORDER: TextRole[] = ["primary", "secondary", "support", "contact"];

function getTextRole(el: EditorElement): TextRole {
  return el.role ?? "support";
}

function roleOrder(role?: TextRole) {
  const index = ROLE_ORDER.indexOf(role ?? "support");
  return index === -1 ? 2 : index;
}

function safeClamp(
  el: EditorElement,
  safeLeft: number,
  safeTop: number,
  safeRight: number,
  safeBottom: number,
) {
  el.x = clamp(el.x, safeLeft, Math.max(safeLeft, safeRight - el.width));
  el.y = clamp(el.y, safeTop, Math.max(safeTop, safeBottom - el.height));

  el.xMm = pxToMm(el.x);
  el.yMm = pxToMm(el.y);
  el.widthMm = pxToMm(el.width);
  el.heightMm = pxToMm(el.height);
}

function getOrientation(w: number, h: number) {
  if (w > h * 1.18) return "landscape";
  if (h > w * 1.18) return "portrait";
  return "square";
}

function getLineHeight(role: TextRole) {
  if (role === "primary") return 0.98;
  if (role === "secondary") return 1.08;
  return 1.12;
}

function getRoleFontRatio(
  role: TextRole,
  orientation: string,
  type: LayoutType,
) {
  const isPortrait = orientation === "portrait";
  const isSquare = orientation === "square";

  if (role === "primary") {
    if (type === "hero") return isPortrait ? 0.13 : isSquare ? 0.122 : 0.115;
    if (type === "split") return isPortrait ? 0.098 : isSquare ? 0.095 : 0.088;
    if (type === "center") return isPortrait ? 0.115 : isSquare ? 0.108 : 0.102;
    return 0.105;
  }

  if (role === "secondary") {
    if (type === "hero") return isPortrait ? 0.066 : 0.058;
    if (type === "split") return isPortrait ? 0.06 : 0.052;
    if (type === "center") return isPortrait ? 0.068 : 0.06;
    return 0.058;
  }

  if (role === "support") {
    if (type === "hero") return isPortrait ? 0.052 : 0.046;
    if (type === "split") return isPortrait ? 0.052 : 0.046;
    if (type === "center") return isPortrait ? 0.056 : 0.05;
    return 0.048;
  }

  if (type === "split") return isPortrait ? 0.046 : 0.04;
  return isPortrait ? 0.048 : 0.043;
}

function getFrame({
  type,
  role,
  safeLeft,
  safeWidth,
  orientation,
}: {
  type: LayoutType;
  role: TextRole;
  safeLeft: number;
  safeWidth: number;
  orientation: string;
}) {
  const isPortrait = orientation === "portrait";

  if (type === "center") {
    const width = role === "primary" ? safeWidth * 0.76 : safeWidth * 0.62;

    return {
      x: safeLeft + (safeWidth - width) / 2,
      width,
      align: "center" as const,
    };
  }

  if (type === "hero") {
    const width = isPortrait ? safeWidth * 0.66 : safeWidth * 0.42;

    return {
      x: safeLeft + safeWidth * 0.07,
      width,
      align: "left" as const,
    };
  }

  if (type === "split") {
    const width = isPortrait ? safeWidth * 0.74 : safeWidth * 0.43;

    return {
      x: safeLeft + safeWidth * 0.07,
      width,
      align: "left" as const,
    };
  }

  const width = safeWidth * 0.7;

  return {
    x: safeLeft + (safeWidth - width) / 2,
    width,
    align: "center" as const,
  };
}

function applyTextStyle({
  el,
  fontSize,
  width,
  align,
  previewCanvasWidth,
  previewCanvasHeight,
}: {
  el: EditorElement;
  fontSize: number;
  width: number;
  align: "left" | "center";
  previewCanvasWidth: number;
  previewCanvasHeight: number;
}) {
  const role = getTextRole(el);
  const roleStyle = getRoleLayoutConfig(
    role,
    previewCanvasWidth,
    previewCanvasHeight,
  );
  const lineHeight = getLineHeight(role);
  const size = Math.round(fontSize);

  el.width = width;
  el.fontSize = size;
  el.fontWeight = roleStyle.fontWeight;
  el.lineHeight = lineHeight;
  el.textAlign = align;
  el.fontScale = 1;

  el.height = Math.ceil(
    measureTextHeightForFont(
      el.text ?? "",
      width,
      size,
      roleStyle.fontWeight,
      lineHeight,
      el.fontFamily,
    ),
  );
}

function stackHeight(items: EditorElement[], gap: number) {
  return (
    items.reduce((sum, el) => sum + el.height, 0) +
    gap * Math.max(0, items.length - 1)
  );
}

function rescaleStackToFit({
  items,
  maxHeight,
  base,
  gapRatio,
  previewCanvasWidth,
  previewCanvasHeight,
}: {
  items: EditorElement[];
  maxHeight: number;
  base: number;
  gapRatio: number;
  previewCanvasWidth: number;
  previewCanvasHeight: number;
}) {
  let gap = base * gapRatio;

  for (let i = 0; i < 10; i++) {
    const total = stackHeight(items, gap);
    if (total <= maxHeight) break;

    items.forEach((el) => {
      applyTextStyle({
        el,
        fontSize: Math.max(12, (el.fontSize ?? 40) * 0.9),
        width: el.width,
        align: (el.textAlign as "left" | "center") ?? "left",
        previewCanvasWidth,
        previewCanvasHeight,
      });
    });

    gap *= 0.94;
  }

  return gap;
}

function placeStack(items: EditorElement[], startY: number, gap: number) {
  let y = startY;

  items.forEach((el) => {
    el.y = y;
    y += el.height + gap;
  });
}

function applyBackgroundMatch(next: EditorElement[]) {
  const bg = next.find((el) => el.name === "AI BG");
  if (!bg) return;

  bg.opacity = 1;
}

export function buildDesignerLayout({
  elements,
  type,
  previewCanvasWidth,
  previewCanvasHeight,
  previewSafe,
}: {
  elements: EditorElement[];
  type: LayoutType;
  previewCanvasWidth: number;
  previewCanvasHeight: number;
  previewSafe: number;
}): EditorElement[] {
  const next = cloneElements(elements);

  const safeLeft = previewSafe;
  const safeTop = previewSafe;
  const safeRight = previewCanvasWidth - previewSafe;
  const safeBottom = previewCanvasHeight - previewSafe;

  const safeWidth = Math.max(1, safeRight - safeLeft);
  const safeHeight = Math.max(1, safeBottom - safeTop);

  const orientation = getOrientation(previewCanvasWidth, previewCanvasHeight);
  const base = Math.min(safeWidth, safeHeight);

  applyBackgroundMatch(next);

  const textEls = next
    .filter((el) => el.type === "text")
    .sort((a, b) => roleOrder(getTextRole(a)) - roleOrder(getTextRole(b)));

  if (textEls.length === 0) return next;

  textEls.forEach((el) => {
    const role = getTextRole(el);

    const frame = getFrame({
      type,
      role,
      safeLeft,
      safeWidth,
      orientation,
    });

    applyTextStyle({
      el,
      fontSize: base * getRoleFontRatio(role, orientation, type),
      width: frame.width,
      align: frame.align,
      previewCanvasWidth,
      previewCanvasHeight,
    });

    el.x = frame.x;
  });

  if (type === "center") {
    const gap = rescaleStackToFit({
      items: textEls,
      maxHeight: safeHeight * 0.5,
      base,
      gapRatio: 0.035,
      previewCanvasWidth,
      previewCanvasHeight,
    });

    const total = stackHeight(textEls, gap);
    placeStack(textEls, safeTop + (safeHeight - total) / 2, gap);
  }

  if (type === "hero") {
    const gap = rescaleStackToFit({
      items: textEls,
      maxHeight: safeHeight * 0.48,
      base,
      gapRatio: 0.03,
      previewCanvasWidth,
      previewCanvasHeight,
    });

    const total = stackHeight(textEls, gap);
    const startY = safeTop + safeHeight * 0.38;
    const maxStartY = safeBottom - total - base * 0.05;

    placeStack(textEls, Math.min(startY, maxStartY), gap);
  }

  if (type === "split") {
    const gap = rescaleStackToFit({
      items: textEls,
      maxHeight: safeHeight * 0.62,
      base,
      gapRatio: 0.038,
      previewCanvasWidth,
      previewCanvasHeight,
    });

    const total = stackHeight(textEls, gap);
    const startY = safeTop + (safeHeight - total) / 2;

    placeStack(textEls, startY, gap);
  }

  textEls.forEach((el) => {
    safeClamp(el, safeLeft, safeTop, safeRight, safeBottom);
  });

  return next;
}
