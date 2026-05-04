export const SNAP_DISTANCE = 8;
export const GUIDE_COLOR = "#2563eb";
export const EXPORT_DPI = 300;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function fitFontSize(text: string) {
  const length = Math.max(text.trim().length, 8);

  if (length <= 10) return 80;
  if (length <= 18) return 64;
  if (length <= 28) return 54;
  if (length <= 40) return 46;
  if (length <= 55) return 38;
  if (length <= 70) return 32;
  return 28;
}

export function mmToPx(mm: number) {
  return mm * 3.7795;
}

export function pxToMm(px: number) {
  return px * 0.264583;
}

export function getPreviewScale(widthMm: number, heightMm: number) {
  const maxPreviewWidthPx = 900;
  const maxPreviewHeightPx = 700;

  const widthPx = mmToPx(widthMm);
  const heightPx = mmToPx(heightMm);

  return Math.min(
    maxPreviewWidthPx / widthPx,
    maxPreviewHeightPx / heightPx,
    1,
  );
}

export const parseMm = (value: string) => {
  const v = String(value).toLowerCase().trim();

  if (v.endsWith("cm")) return Number(v.replace("cm", "")) * 10;
  if (v.endsWith("m")) return Number(v.replace("m", "")) * 1000;

  return Number(v);
};
