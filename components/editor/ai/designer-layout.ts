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
    if (type === "center") {
      return isPortrait ? 0.108 : isSquare ? 0.104 : 0.102;
    }

    if (type === "top-heavy") {
      return isPortrait ? 0.122 : isSquare ? 0.118 : 0.115;
    }

    if (type === "hero") {
      return isPortrait ? 0.118 : isSquare ? 0.112 : 0.108;
    }

    if (type === "split-balanced") {
      return isPortrait ? 0.105 : isSquare ? 0.1 : 0.098;
    }

    return isPortrait ? 0.112 : isSquare ? 0.108 : 0.104;
  }

  if (role === "secondary") {
    if (type === "split") return 0.075;
    if (type === "split-balanced") return 0.065;
    return isPortrait ? 0.07 : 0.068;
  }

  if (role === "support") {
    if (type === "split-balanced") return 0.058;
    return isPortrait ? 0.06 : 0.058;
  }

  return isPortrait ? 0.052 : 0.048;
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

  if (type === "top-heavy") {
    const width = role === "primary" ? safeWidth * 0.62 : safeWidth * 0.56;

    return {
      x: safeLeft + safeWidth * 0.06,
      width,
      align: "left" as const,
    };
  }

  if (type === "hero") {
    const width = isPortrait ? safeWidth * 0.64 : safeWidth * 0.46;

    return {
      x: safeLeft + safeWidth * 0.07,
      width,
      align: "left" as const,
    };
  }

  if (type === "split") {
    if (isPortrait) {
      const width = role === "primary" ? safeWidth * 0.78 : safeWidth * 0.68;

      return {
        x: safeLeft + (safeWidth - width) / 2,
        width,
        align: role === "primary" ? ("left" as const) : ("center" as const),
      };
    }

    if (role === "primary") {
      return {
        x: safeLeft + safeWidth * 0.04,
        width: safeWidth * 0.42,
        align: "left" as const,
      };
    }

    return {
      x: safeLeft + safeWidth * 0.56,
      width: safeWidth * 0.36,
      align: "left" as const,
    };
  }

  if (type === "split-balanced") {
    if (role === "primary") {
      const width = safeWidth * 0.72;

      return {
        x: safeLeft + (safeWidth - width) / 2,
        width,
        align: "center" as const,
      };
    }

    if (role === "contact") {
      const width = safeWidth * 0.58;

      return {
        x: safeLeft + (safeWidth - width) / 2,
        width,
        align: "center" as const,
      };
    }

    const width = isPortrait ? safeWidth * 0.68 : safeWidth * 0.38;

    return {
      x:
        role === "secondary"
          ? safeLeft + safeWidth * 0.06
          : safeLeft + safeWidth * 0.56,
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

function applyBackgroundMatch(next: EditorElement[], type: LayoutType) {
  const bg = next.find((el) => el.name === "AI BG");
  if (!bg) return;

  // AI background should stay visually intact.
  // Layout dropdown must reposition editable text only,
  // not weaken or fade the generated background.
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

  applyBackgroundMatch(next, type);

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

  if (type === "top-heavy") {
    const gap = rescaleStackToFit({
      items: textEls,
      maxHeight: safeHeight * 0.72,
      base,
      gapRatio: 0.035,
      previewCanvasWidth,
      previewCanvasHeight,
    });

    placeStack(textEls, safeTop + safeHeight * 0.09, gap);
  }

  if (type === "hero") {
    const gap = rescaleStackToFit({
      items: textEls,
      maxHeight: safeHeight * 0.46,
      base,
      gapRatio: 0.024,
      previewCanvasWidth,
      previewCanvasHeight,
    });

    const total = stackHeight(textEls, gap);
    const startY = safeTop + safeHeight * 0.46;
    const maxStartY = safeBottom - total - base * 0.04;

    placeStack(textEls, Math.min(startY, maxStartY), gap);
  }

  if (type === "split") {
    if (orientation === "portrait") {
      const gap = rescaleStackToFit({
        items: textEls,
        maxHeight: safeHeight * 0.68,
        base,
        gapRatio: 0.03,
        previewCanvasWidth,
        previewCanvasHeight,
      });

      const total = stackHeight(textEls, gap);
      placeStack(textEls, safeTop + (safeHeight - total) / 2, gap);
    } else {
      const left = textEls.filter((el) => getTextRole(el) === "primary");
      const right = textEls.filter((el) => getTextRole(el) !== "primary");

      const leftGap = rescaleStackToFit({
        items: left,
        maxHeight: safeHeight * 0.56,
        base,
        gapRatio: 0.025,
        previewCanvasWidth,
        previewCanvasHeight,
      });

      const rightGap = rescaleStackToFit({
        items: right,
        maxHeight: safeHeight * 0.52,
        base,
        gapRatio: 0.03,
        previewCanvasWidth,
        previewCanvasHeight,
      });

      const leftTotal = stackHeight(left, leftGap);
      const rightTotal = stackHeight(right, rightGap);

      placeStack(left, safeTop + (safeHeight - leftTotal) / 2, leftGap);
      placeStack(right, safeTop + (safeHeight - rightTotal) / 2, rightGap);
    }
  }

  if (type === "split-balanced") {
    const primary = textEls.find((el) => getTextRole(el) === "primary");
    const others = textEls.filter((el) => getTextRole(el) !== "primary");

    if (primary) {
      applyTextStyle({
        el: primary,
        fontSize: base * getRoleFontRatio("primary", orientation, type),
        width: safeWidth * 0.62,
        align: "center",
        previewCanvasWidth,
        previewCanvasHeight,
      });

      primary.x = safeLeft + (safeWidth - primary.width) / 2;
      primary.y = safeTop + safeHeight * 0.12;
    }

    const left = others.filter((_, index) => index % 2 === 0);
    const right = others.filter((_, index) => index % 2 === 1);

    left.forEach((el) => {
      applyTextStyle({
        el,
        fontSize: base * getRoleFontRatio(getTextRole(el), orientation, type),
        width: safeWidth * 0.32,
        align: "left",
        previewCanvasWidth,
        previewCanvasHeight,
      });

      el.x = safeLeft + safeWidth * 0.16;
    });

    right.forEach((el) => {
      applyTextStyle({
        el,
        fontSize: base * getRoleFontRatio(getTextRole(el), orientation, type),
        width: safeWidth * 0.32,
        align: "left",
        previewCanvasWidth,
        previewCanvasHeight,
      });

      el.x = safeLeft + safeWidth * 0.58;
    });

    const gap = base * 0.035;
    const topOfColumns =
      primary != null
        ? primary.y + primary.height + safeHeight * 0.12
        : safeTop + safeHeight * 0.42;

    const leftTotal = stackHeight(left, gap);
    const rightTotal = stackHeight(right, gap);

    placeStack(left, topOfColumns, gap);
    placeStack(
      right,
      topOfColumns + Math.max(0, (leftTotal - rightTotal) / 2),
      gap,
    );
  }

  textEls.forEach((el) => {
    safeClamp(el, safeLeft, safeTop, safeRight, safeBottom);
  });

  return next;
}
