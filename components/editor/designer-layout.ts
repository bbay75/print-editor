import type { EditorElement, TextRole } from "./editor-types";
import { cloneElements } from "./editor-history";
import { pxToMm } from "./editor-utils";
import {
  getRoleLayoutConfig,
  fitFontSizeSmart,
  measureTextHeightForFont,
} from "./editor-typography";

function area(el: any) {
  return el.width * el.height;
}

function overlapArea(a: any, b: any) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

export function buildDesignerLayout({
  elements,
  type,
  previewCanvasWidth,
  previewCanvasHeight,
  previewSafe,
}: {
  elements: EditorElement[];
  type: "center" | "top-heavy" | "hero" | "split";
  previewCanvasWidth: number;
  previewCanvasHeight: number;
  previewSafe: number;
}) {
  const next = cloneElements(elements);

  const safeLeft = previewSafe;
  const safeTop = previewSafe;
  const safeRight = previewCanvasWidth - previewSafe;
  const safeBottom = previewCanvasHeight - previewSafe;

  const safeWidth = safeRight - safeLeft;
  const safeHeight = safeBottom - safeTop;

  const textEls = next
    .filter((el) => el.type === "text")
    .sort((a, b) => {
      const order: TextRole[] = ["primary", "secondary", "support", "contact"];
      return (
        order.indexOf(a.role ?? "support") - order.indexOf(b.role ?? "support")
      );
    });

  if (textEls.length === 0) return next;

  let boxWidth = safeWidth * 0.9;
  let boxX = safeLeft + (safeWidth - boxWidth) / 2;
  let align: "left" | "center" | "right" = "center";

  if (type === "split") {
    boxWidth = safeWidth * 0.45;
    boxX = safeLeft + safeWidth * 0.05;
    align = "left";
  }

  let gap = previewCanvasHeight * 0.035;

  // 👉 font size & height тооцоо
  textEls.forEach((el) => {
    const role = el.role ?? "support";

    const style = getRoleLayoutConfig(
      role,
      previewCanvasWidth,
      previewCanvasHeight,
    );

    let font =
      fitFontSizeSmart(
        el.text ?? "",
        role,
        boxWidth,
        style.boxHeight,
        previewCanvasWidth,
        previewCanvasHeight,
      ) * 1;

    // 🔥 dominance
    if (role === "primary")
      font *= 1.1; // 🔥 багасгалаа
    else if (role === "secondary") font *= 1.0;
    else if (role === "support") font *= 0.95;
    else if (role === "contact") font *= 0.9;

    const height = measureTextHeightForFont(
      el.text ?? "",
      boxWidth,
      Math.round(font),
      style.fontWeight,
      style.lineHeight,
      el.fontFamily,
    );

    el.width = boxWidth;
    el.height = height;
    el.fontSize = Math.round(font);
    el.fontWeight = style.fontWeight;
    el.lineHeight = style.lineHeight;
    el.textAlign = align;
  });

  // 👉 нийт өндөр
  const totalHeight =
    textEls.reduce((sum, el) => sum + el.height, 0) +
    gap * (textEls.length - 1);

  let y = safeTop + (safeHeight - totalHeight) / 2;

  if (type === "top-heavy") {
    y = safeTop + previewCanvasHeight * 0.05;
  }

  if (type === "hero") {
    y = safeTop + previewCanvasHeight * 0.12;
  }

  textEls.forEach((el) => {
    el.x = boxX;
    el.y = y;

    el.xMm = pxToMm(el.x);
    el.yMm = pxToMm(el.y);
    el.widthMm = pxToMm(el.width);
    el.heightMm = pxToMm(el.height);

    y += el.height + gap;
  });
  textEls.sort((a, b) => a.y - b.y);
  // 🔥 SOFT SMART LAYOUT ENGINE

  const strength = 0.4; // 🔥 зөөлөн хүч (0.2–0.5)

  // 👉 1. HEADLINE CENTER LOCK (soft)
  const primary = textEls.find((el) => el.role === "primary");

  if (primary) {
    const centerX = safeLeft + safeWidth / 2 - primary.width / 2;

    // шууд биш, бага зэрэг татна
    primary.x += (centerX - primary.x) * strength;
    primary.xMm = pxToMm(primary.x);
  }

  // 👉 2. CONTACT BOTTOM (soft)
  const contact = textEls.find((el) => el.role === "contact");

  if (contact) {
    const targetY = safeBottom - contact.height;

    contact.y += (targetY - contact.y) * strength;
    contact.yMm = pxToMm(contact.y);
  }

  // 👉 3. OVERLAP FIX (threshold-based)
  for (let i = 1; i < textEls.length; i++) {
    const prev = textEls[i - 1];
    const curr = textEls[i];

    const minY = prev.y + prev.height + gap;

    if (curr.y < minY) {
      curr.y = minY;
      curr.yMm = pxToMm(curr.y);
    }
  }

  // 👉 4. AUTO SPACING BALANCE

  textEls.forEach((el, i) => {
    if (i === 0) return;

    const prev = textEls[i - 1];
    const desiredY = prev.y + prev.height + gap;

    el.y += (desiredY - el.y) * 0.3;
    el.yMm = pxToMm(el.y);
  });
  // 🔥 SAFE AREA FINAL CLAMP
  textEls.forEach((el) => {
    if (el.y < safeTop) {
      el.y = safeTop;
    }

    if (el.y + el.height > safeBottom) {
      el.y = safeBottom - el.height;
    }

    el.yMm = pxToMm(el.y);
    el.xMm = pxToMm(el.x);
  });
  return next;
}
