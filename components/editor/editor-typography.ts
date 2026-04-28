import type { TextRole } from "./editor-types";
import { clamp } from "./editor-utils";
export function getRoleLayoutConfig(
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

export function fitFontSizeSmart(
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

export function measureTextHeightForFont(
  text: string,
  widthPx: number,
  fontSizePx: number,
  fontWeight: number,
  lineHeight: number,
  fontFamily?: string,
) {
  if (typeof document === "undefined") return fontSizePx * lineHeight;

  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "-99999px";
  el.style.top = "-99999px";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.width = `${Math.max(20, widthPx)}px`;
  el.style.fontSize = `${fontSizePx}px`;
  el.style.fontWeight = String(fontWeight);
  el.style.lineHeight = String(lineHeight);

  // 🔥 ЭНЭ ХАМГИЙН ЧУХАЛ
  el.style.fontFamily = fontFamily || "Inter, sans-serif";

  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.overflowWrap = "anywhere";
  el.style.textAlign = "left";
  el.style.padding = "0";
  el.style.margin = "0";
  el.style.boxSizing = "border-box";

  el.textContent = text || "";

  document.body.appendChild(el);
  const h = el.scrollHeight;
  document.body.removeChild(el);

  return h;
}
