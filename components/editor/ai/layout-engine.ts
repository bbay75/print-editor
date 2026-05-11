export type TextRole = "primary" | "secondary" | "support" | "contact";

export type LayoutPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type LayoutType = "hero" | "split" | "center";

export function getLayoutPosition(
  role: TextRole,
  layoutType: LayoutType,
): LayoutPosition {
  if (layoutType === "hero") {
    if (role === "contact") return "bottom-left";
    return "center-left";
  }

  if (layoutType === "split") {
    if (role === "contact") return "bottom-left";
    return "center-left";
  }

  if (layoutType === "center") {
    if (role === "primary") return "center";
    if (role === "contact") return "bottom-center";
    return "center";
  }

  return "center";
}

export function getPositionXY(params: {
  position: LayoutPosition;
  boxWidth: number;
  boxHeight: number;
  safeLeft: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
}) {
  const {
    position,
    boxWidth,
    boxHeight,
    safeLeft,
    safeTop,
    safeRight,
    safeBottom,
  } = params;

  const safeWidth = safeRight - safeLeft;
  const safeHeight = safeBottom - safeTop;

  const left = safeLeft;
  const centerX = safeLeft + (safeWidth - boxWidth) / 2;
  const right = safeRight - boxWidth;

  const top = safeTop;
  const centerY = safeTop + (safeHeight - boxHeight) / 2;
  const bottom = safeBottom - boxHeight;

  switch (position) {
    case "top-left":
      return { x: left, y: top, textAlign: "left" as const };
    case "top-center":
      return { x: centerX, y: top, textAlign: "center" as const };
    case "top-right":
      return { x: right, y: top, textAlign: "right" as const };
    case "center-left":
      return { x: left, y: centerY, textAlign: "left" as const };
    case "center":
      return { x: centerX, y: centerY, textAlign: "center" as const };
    case "center-right":
      return { x: right, y: centerY, textAlign: "left" as const };
    case "bottom-left":
      return { x: left, y: bottom, textAlign: "left" as const };
    case "bottom-center":
      return { x: centerX, y: bottom, textAlign: "center" as const };
    case "bottom-right":
      return { x: right, y: bottom, textAlign: "right" as const };
  }
}
