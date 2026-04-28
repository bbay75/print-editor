import {
  getLayoutPosition,
  getPositionXY,
  type LayoutPosition,
  type LayoutType,
} from "./layout-engine";

type TextRole = "primary" | "secondary" | "support" | "contact";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function pxToMm(px: number) {
  return px * 0.264583;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function looksLikeContact(text: string) {
  return /(\+?\d[\d\s-]{5,})/.test(text);
}

function getRoleLayoutConfig(
  role: TextRole,
  canvasWidth: number,
  canvasHeight: number,
) {
  const shortSide = Math.min(canvasWidth, canvasHeight);

  if (role === "primary") {
    return {
      boxHeight: canvasHeight * 0.18,
      gap: canvasHeight * 0.01,
      minFont: shortSide * 0.095,
      maxFont: shortSide * 0.24,
      lineHeight: 0.96,
      fontWeight: 850,
    };
  }

  if (role === "secondary") {
    return {
      boxHeight: canvasHeight * 0.085,
      gap: canvasHeight * 0.008,
      minFont: shortSide * 0.036,
      maxFont: shortSide * 0.085,
      lineHeight: 1.04,
      fontWeight: 650,
    };
  }

  if (role === "contact") {
    return {
      boxHeight: canvasHeight * 0.09,
      gap: canvasHeight * 0.006,
      minFont: shortSide * 0.026,
      maxFont: shortSide * 0.055,
      lineHeight: 1.02,
      fontWeight: 700,
    };
  }

  return {
    boxHeight: canvasHeight * 0.075,
    gap: canvasHeight * 0.008,
    minFont: shortSide * 0.03,
    maxFont: shortSide * 0.065,
    lineHeight: 1.04,
    fontWeight: 600,
  };
}

function fitFontSizeSmart(
  text: string,
  role: TextRole,
  boxWidth: number,
  boxHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const cfg = getRoleLayoutConfig(role, canvasWidth, canvasHeight);
  const safeText = (text || "").trim() || "Text";
  const lines = safeText.split("\n");
  const longest = Math.max(...lines.map((line) => line.length), 6);

  const byWidth = boxWidth / Math.max(longest * 0.5, 4);
  const byHeight =
    boxHeight / Math.max(lines.length * (cfg.lineHeight || 1.1), 1);

  return Math.round(
    clamp(Math.min(byWidth, byHeight), cfg.minFont, cfg.maxFont),
  );
}

export function buildAiElements({
  data,
  widthMm,
  heightMm,
  previewCanvasWidth,
  previewCanvasHeight,
  previewSafe,
  layoutType,
}: {
  data: any;
  widthMm: number;
  heightMm: number;
  previewCanvasWidth: number;
  previewCanvasHeight: number;
  previewSafe: number;
  layoutType: LayoutType;
}) {
  const nextElements: any[] = [];

  if (data.image) {
    nextElements.push({
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
      aspectRatio: previewCanvasWidth / previewCanvasHeight,
    });
  }

  const safeLeft = previewSafe;
  const safeTop = previewSafe;
  const safeRight = previewCanvasWidth - previewSafe;
  const safeBottom = previewCanvasHeight - previewSafe;
  const safeWidth = Math.max(260, safeRight - safeLeft);

  const texts: any[] = Array.isArray(data.texts) ? data.texts : [];

  texts.forEach((t: any) => {
    const rawText = String(t.text || "").trim();
    if (!rawText) return;

    const sourceRole =
      t.role === "headline" || t.role === "cta" ? t.role : "line";

    const mappedRole: TextRole =
      sourceRole === "headline"
        ? "primary"
        : looksLikeContact(rawText)
          ? "contact"
          : rawText.length <= 28
            ? "support"
            : "secondary";

    const cfg = getRoleLayoutConfig(
      mappedRole,
      previewCanvasWidth,
      previewCanvasHeight,
    );

    const boxHeight = cfg.boxHeight;
    const boxWidth = safeWidth;

    const safeFontSize = fitFontSizeSmart(
      rawText,
      mappedRole,
      safeWidth,
      boxHeight,
      previewCanvasWidth,
      previewCanvasHeight,
    );

    let finalFontSize = safeFontSize;
    let finalShadow = "0 2px 8px rgba(0,0,0,0.18)";

    if (layoutType === "hero" && mappedRole === "primary") {
      finalFontSize = safeFontSize * 1.4;
      finalShadow = "0 8px 30px rgba(0,0,0,0.7)";
    }

    if (layoutType === "top-heavy" && mappedRole === "primary") {
      finalFontSize = safeFontSize * 1.2;
      finalShadow = "0 6px 20px rgba(0,0,0,0.6)";
    }

    if (layoutType === "split" && mappedRole === "primary") {
      finalShadow = "0 5px 18px rgba(0,0,0,0.55)";
    }

    if (layoutType === "hero" && mappedRole !== "primary") {
      finalFontSize = safeFontSize * 0.8;
    }

    const position = getLayoutPosition(
      mappedRole,
      layoutType,
    ) as LayoutPosition;

    const placed = getPositionXY({
      position,
      boxWidth,
      boxHeight,
      safeLeft,
      safeTop,
      safeRight,
      safeBottom,
    });

    let finalX = placed.x;
    let finalY = placed.y;

    if (layoutType === "split") {
      if (mappedRole === "primary") {
        finalX = safeLeft + safeWidth * 0.05;
      } else {
        finalX = safeLeft + safeWidth * 0.55;
      }
    }

    nextElements.push({
      id: makeId(),
      type: "text",
      name:
        mappedRole === "primary"
          ? "Primary"
          : mappedRole === "contact"
            ? "Contact"
            : "Secondary",
      role: mappedRole,
      text: rawText,
      x: finalX,
      y: finalY,
      xMm: pxToMm(finalX),
      yMm: pxToMm(finalY),
      width: boxWidth,
      height: boxHeight,
      widthMm: pxToMm(boxWidth),
      heightMm: pxToMm(boxHeight),
      rotation: 0,
      opacity: 1,
      color:
        typeof t.color === "string" && t.color.trim()
          ? t.color.trim()
          : mappedRole === "primary"
            ? "#f8fafc"
            : mappedRole === "contact"
              ? "#facc15"
              : "#e5e7eb",
      fontSize: finalFontSize,
      fontScale: 1,
      fontWeight: cfg.fontWeight,
      fontFamily: "var(--font-inter), Inter, sans-serif",
      textAlign: placed.textAlign,
      lineHeight: cfg.lineHeight,
      borderRadius: 0,
      textShadow: finalShadow,
      position,
    });
  });

  return nextElements;
}
