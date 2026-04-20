"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Undo2,
  Redo2,
  Type,
  Minus,
  Plus,
  Printer,
  ImagePlus,
  Wand2,
  PanelTopClose,
  X,
  Trash2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  type LucideIcon,
} from "lucide-react";

type ElementType = "text" | "logo" | "line";
type TextRole = "primary" | "secondary" | "support" | "contact";

type EditorElement = {
  id: string;
  type: ElementType;
  name: string;
  role?: TextRole;

  x: number;
  y: number;
  width: number;
  height: number;

  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;

  rotation: number;
  opacity: number;
  color?: string;
  text?: string;
  fontSize?: number;
  fontScale?: number;
  fontWeight?: number;
  fontFamily?: string;
  src?: string;
  borderRadius?: number;
  lineThickness?: number;
  aspectRatio?: number;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  textShadow?: string;
};

const SNAP_DISTANCE = 8;
const GUIDE_COLOR = "#2563eb";
const EXPORT_DPI = 300;

const FONT_OPTIONS = [
  { label: "Inter", value: "var(--font-inter), Inter, sans-serif" },
  { label: "Noto Sans", value: "var(--font-noto-sans), sans-serif" },
  { label: "Oswald", value: "var(--font-oswald), sans-serif" },
  { label: "Marck Script", value: "var(--font-marck-script), cursive" },
  { label: "Caveat", value: "var(--font-caveat), cursive" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function fitFontSize(text: string) {
  const length = Math.max(text.trim().length, 8);

  if (length <= 10) return 80;
  if (length <= 18) return 64;
  if (length <= 28) return 54;
  if (length <= 40) return 46;
  if (length <= 55) return 38;
  if (length <= 70) return 32;
  return 28;
}

function mmToPx(mm: number) {
  return mm * 3.7795;
}

function pxToMm(px: number) {
  return px * 0.264583;
}

async function initPdfFonts(pdf: jsPDF) {
  const regularRes = await fetch("/fonts/NotoSans-Regular.ttf");
  const boldRes = await fetch("/fonts/NotoSans-Bold.ttf");

  const regularBuffer = await regularRes.arrayBuffer();
  const boldBuffer = await boldRes.arrayBuffer();

  const regularBinary = arrayBufferToBinaryString(regularBuffer);
  const boldBinary = arrayBufferToBinaryString(boldBuffer);

  pdf.addFileToVFS("NotoSans-Regular.ttf", regularBinary);
  pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");

  pdf.addFileToVFS("NotoSans-Bold.ttf", boldBinary);
  pdf.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
}

function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const subarray = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...subarray);
  }

  return binary;
}

function getPreviewScale(widthMm: number, heightMm: number) {
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

function fontPxToPt(px: number) {
  return px * 0.75;
}

function getPdfTextAlign(
  align?: "left" | "center" | "right",
): "left" | "center" | "right" {
  if (align === "center") return "center";
  if (align === "right") return "right";
  return "left";
}

function createTextElement(
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
    height: Math.max(70, Math.round(fontSize * 1.35)),
    xMm: pxToMm(x),
    yMm: pxToMm(y),
    widthMm: pxToMm(Math.min(canvasWidth * 0.8, 760)),
    heightMm: pxToMm(Math.max(70, Math.round(fontSize * 1.35))),
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

function createLineElement(): EditorElement {
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

function getRoleLayoutConfig(
  role: TextRole,
  canvasWidth: number,
  canvasHeight: number,
) {
  const shortSide = Math.min(canvasWidth, canvasHeight);

  if (role === "primary") {
    return {
      boxHeight: canvasHeight * 0.22,
      gap: canvasHeight * 0.018,
      minFont: shortSide * 0.07,
      maxFont: shortSide * 0.2,
      lineHeight: 0.98,
      fontWeight: 800,
    };
  }

  if (role === "secondary") {
    return {
      boxHeight: canvasHeight * 0.1,
      gap: canvasHeight * 0.014,
      minFont: shortSide * 0.03,
      maxFont: shortSide * 0.09,
      lineHeight: 1.08,
      fontWeight: 600,
    };
  }

  if (role === "contact") {
    return {
      boxHeight: canvasHeight * 0.07,
      gap: canvasHeight * 0.01,
      minFont: shortSide * 0.024,
      maxFont: shortSide * 0.06,
      lineHeight: 1.05,
      fontWeight: 700,
    };
  }

  return {
    boxHeight: canvasHeight * 0.08,
    gap: canvasHeight * 0.012,
    minFont: shortSide * 0.026,
    maxFont: shortSide * 0.07,
    lineHeight: 1.08,
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

function measureTextHeightForFont(
  text: string,
  widthPx: number,
  fontSizePx: number,
  fontWeight: number,
  lineHeight: number,
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
  el.style.fontFamily = "Inter, sans-serif";
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

function getSafeAreaFitMaxFontSize({
  text,
  widthPx,
  currentX,
  currentY,
  docWidth,
  docHeight,
  previewSafe,
  fontWeight,
  lineHeight,
  role,
}: {
  text: string;
  widthPx: number;
  currentX: number;
  currentY: number;
  docWidth: number;
  docHeight: number;
  previewSafe: number;
  fontWeight: number;
  lineHeight: number;
  role?: TextRole;
}) {
  const safeLeft = previewSafe;
  const safeRight = docWidth - previewSafe;
  const safeTop = previewSafe;
  const safeBottom = docHeight - previewSafe;

  const clampedX = Math.max(currentX, safeLeft);
  const clampedY = Math.max(currentY, safeTop);

  const allowedWidth = Math.min(widthPx, safeRight - clampedX);
  const allowedHeight = safeBottom - clampedY;

  if (allowedWidth <= 40 || allowedHeight <= 40) {
    return role === "contact" ? 24 : 40;
  }

  let low = role === "contact" ? 12 : 16;
  let high = 4000;
  let best = low;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    const h = measureTextHeightForFont(
      text,
      allowedWidth,
      mid,
      fontWeight,
      lineHeight,
    );

    if (h <= allowedHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={
        variant === "primary"
          ? "inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
          : "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  onStart,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  onStart?: () => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span>
        {label}: {step < 1 ? value.toFixed(2) : Math.round(value)}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={onStart}
        onMouseDown={onStart}
        onTouchStart={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onPointerUp={onCommit}
      />
    </label>
  );
}

function SafeColorInput({
  value,
  onChange,
  onCommit,
  onStart,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  onStart?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-11 w-full rounded-xl border border-slate-200 bg-white" />
    );
  }

  return (
    <input
      type="color"
      value={value}
      onPointerDown={onStart}
      onMouseDown={onStart}
      onFocus={onStart}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className="h-11 w-full rounded-xl border border-slate-200 p-1"
      suppressHydrationWarning
    />
  );
}

function MiniActionBar({
  type,
  onDelete,
  showMoveHandle,
  onMovePointerDown,
}: {
  type: ElementType;
  onDelete: () => void;
  showMoveHandle?: boolean;
  onMovePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="absolute -top-11 left-0 z-20 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur">
      <span>
        {type === "text" ? "Текст" : type === "logo" ? "Лого" : "Шугам"}
      </span>

      {showMoveHandle && onMovePointerDown && (
        <>
          <span className="h-4 w-px bg-slate-200" />
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMovePointerDown(e);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-700 hover:bg-slate-100"
            title="Зөөх"
          >
            <Move className="h-3.5 w-3.5" />
            Зөөх
          </button>
        </>
      )}

      <span className="h-4 w-px bg-slate-200" />
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-600 hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Устгах
      </button>
    </div>
  );
}

function CanvasItem({
  element,
  scale,
  selected,
  docWidth,
  docHeight,
  previewBleed,
  previewSafe,
  onSelect,
  onDelete,
  onPatch,
  onCommit,
  onDragStart,
  onDragEnd,
  onGuidesChange,
}: {
  element: EditorElement;
  scale: number;
  selected: boolean;
  docWidth: number;
  docHeight: number;
  previewBleed: number;
  previewSafe: number;
  onSelect: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<EditorElement>) => void;
  onCommit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onGuidesChange: (guides: {
    vertical: number | null;
    horizontal: number | null;
  }) => void;
}) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    changed: boolean;
  } | null>(null);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    baseW: number;
    baseH: number;
    changed: boolean;
  } | null>(null);

  const textSnapshotRef = useRef<string | null>(null);

  const getLogicalX = () =>
    element.xMm !== undefined ? mmToPx(element.xMm) : element.x;

  const getLogicalY = () =>
    element.yMm !== undefined ? mmToPx(element.yMm) : element.y;

  const getLogicalW = () =>
    element.widthMm !== undefined ? mmToPx(element.widthMm) : element.width;

  const getLogicalH = () =>
    element.heightMm !== undefined ? mmToPx(element.heightMm) : element.height;

  const startDrag = (clientX: number, clientY: number) => {
    onSelect();
    onDragStart();
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      baseX: getLogicalX(),
      baseY: getLogicalY(),
      changed: false,
    };
  };

  const measureTextHeight = (nextWidth: number) => {
    const measureEl = measureRef.current;
    if (!measureEl) return Math.max(getLogicalH(), 60);

    measureEl.style.width = `${Math.max(nextWidth * scale, 20)}px`;
    measureEl.style.height = "auto";
    measureEl.style.fontSize = `${(element.fontSize ?? 40) * (element.fontScale ?? 1) * scale}px`;
    measureEl.style.fontWeight = String(element.fontWeight ?? 400);
    measureEl.style.fontFamily =
      element.fontFamily ?? "var(--font-inter), Inter, sans-serif";
    measureEl.style.lineHeight = String(element.lineHeight ?? 1.2);
    measureEl.style.whiteSpace = "pre-wrap";
    measureEl.style.wordBreak = "break-word";
    measureEl.style.overflowWrap = "anywhere";
    measureEl.style.padding = "0";
    measureEl.style.boxSizing = "border-box";
    measureEl.textContent = element.text ?? "";

    return Math.max(Math.ceil(measureEl.scrollHeight / scale), 60);
  };

  const getVisualBounds = () => {
    if (element.type === "text") {
      const h = Math.max(
        getLogicalH(),
        (textRef.current?.scrollHeight ?? 0) / scale,
        60,
      );

      return {
        width: getLogicalW(),
        height: h,
      };
    }

    return {
      width: getLogicalW(),
      height: getLogicalH(),
    };
  };

  const applySnapping = (
    nextX: number,
    nextY: number,
    visualWidth: number,
    visualHeight: number,
  ) => {
    let snappedX = clamp(nextX, 0, docWidth - visualWidth);
    let snappedY = clamp(nextY, 0, docHeight - visualHeight);

    let verticalGuide: number | null = null;
    let horizontalGuide: number | null = null;

    const left = snappedX;
    const right = snappedX + visualWidth;
    const top = snappedY;
    const bottom = snappedY + visualHeight;
    const centerX = snappedX + visualWidth / 2;
    const centerY = snappedY + visualHeight / 2;

    const safeLeft = previewSafe;
    const safeRight = docWidth - previewSafe;
    const safeTop = previewSafe;
    const safeBottom = docHeight - previewSafe;

    if (Math.abs(left - 0) < SNAP_DISTANCE) {
      snappedX = 0;
      verticalGuide = 0;
    }
    if (Math.abs(left - safeLeft) < SNAP_DISTANCE) {
      snappedX = safeLeft;
      verticalGuide = safeLeft;
    }
    if (Math.abs(right - docWidth) < SNAP_DISTANCE) {
      snappedX = docWidth - visualWidth;
      verticalGuide = docWidth;
    }
    if (Math.abs(right - safeRight) < SNAP_DISTANCE) {
      snappedX = safeRight - visualWidth;
      verticalGuide = safeRight;
    }
    if (Math.abs(centerX - docWidth / 2) < SNAP_DISTANCE) {
      snappedX = docWidth / 2 - visualWidth / 2;
      verticalGuide = docWidth / 2;
    }

    if (Math.abs(top - 0) < SNAP_DISTANCE) {
      snappedY = 0;
      horizontalGuide = 0;
    }
    if (Math.abs(top - safeTop) < SNAP_DISTANCE) {
      snappedY = safeTop;
      horizontalGuide = safeTop;
    }
    if (Math.abs(bottom - docHeight) < SNAP_DISTANCE) {
      snappedY = docHeight - visualHeight;
      horizontalGuide = docHeight;
    }
    if (Math.abs(bottom - safeBottom) < SNAP_DISTANCE) {
      snappedY = safeBottom - visualHeight;
      horizontalGuide = safeBottom;
    }
    if (Math.abs(centerY - docHeight / 2) < SNAP_DISTANCE) {
      snappedY = docHeight / 2 - visualHeight / 2;
      horizontalGuide = docHeight / 2;
    }

    return { snappedX, snappedY, verticalGuide, horizontalGuide };
  };

  const handleBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (element.name === "AI BG") return;

    e.stopPropagation();
    onSelect();

    if (element.type !== "text") {
      startDrag(e.clientX, e.clientY);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const handleMoveHandlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const dx = (e.clientX - dragRef.current.startX) / scale;
    const dy = (e.clientY - dragRef.current.startY) / scale;

    const visual = getVisualBounds();
    const rawX = dragRef.current.baseX + dx;
    const rawY = dragRef.current.baseY + dy;

    const { snappedX, snappedY, verticalGuide, horizontalGuide } =
      applySnapping(rawX, rawY, visual.width, visual.height);

    dragRef.current.changed = true;

    onPatch({
      x: snappedX,
      y: snappedY,
      xMm: pxToMm(snappedX),
      yMm: pxToMm(snappedY),
    });

    onGuidesChange({
      vertical: verticalGuide,
      horizontal: horizontalGuide,
    });
  };

  const handlePointerUp = () => {
    if (dragRef.current?.changed) onCommit();
    dragRef.current = null;
    onGuidesChange({ vertical: null, horizontal: null });
    onDragEnd();
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    onDragStart();

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseW: getLogicalW(),
      baseH: getLogicalH(),
      changed: false,
    };

    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;

    const dx = (e.clientX - resizeRef.current.startX) / scale;
    const dy = (e.clientY - resizeRef.current.startY) / scale;

    const logicalX = getLogicalX();
    const logicalY = getLogicalY();

    if (element.type === "text") {
      const minWidth = 260;
      const nextWidth = clamp(
        resizeRef.current.baseW + dx,
        minWidth,
        docWidth - logicalX,
      );
      const nextHeight = measureTextHeight(nextWidth);

      resizeRef.current.changed = true;

      onPatch({
        width: nextWidth,
        height: nextHeight,
        widthMm: pxToMm(nextWidth),
        heightMm: pxToMm(nextHeight),
      });
      return;
    }

    if (element.type === "logo") {
      const ratio = element.aspectRatio ?? 1;
      const nextWidth = clamp(
        resizeRef.current.baseW + dx,
        60,
        docWidth - logicalX,
      );
      const nextHeight = Math.max(60, Math.round(nextWidth / ratio));

      resizeRef.current.changed = true;

      onPatch({
        width: nextWidth,
        height: nextHeight,
        widthMm: pxToMm(nextWidth),
        heightMm: pxToMm(nextHeight),
      });
      return;
    }

    const nextWidth = clamp(
      resizeRef.current.baseW + dx,
      60,
      docWidth - logicalX,
    );
    const nextThickness = clamp(
      resizeRef.current.baseH + dy,
      2,
      Math.max(30, docHeight - logicalY),
    );

    resizeRef.current.changed = true;

    onPatch({
      width: nextWidth,
      height: nextThickness,
      lineThickness: nextThickness,
      widthMm: pxToMm(nextWidth),
      heightMm: pxToMm(nextThickness),
    });
  };

  const handleResizeEnd = () => {
    if (resizeRef.current?.changed) onCommit();
    resizeRef.current = null;
    onGuidesChange({ vertical: null, horizontal: null });
    onDragEnd();
  };

  const lastAutoHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (element.type !== "text") return;
    if (!textRef.current) return;

    const el = textRef.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;

    const logicalHeight = Math.max(el.scrollHeight / scale, 60);
    const currentHeight = getLogicalH();

    const roundedNext = Math.round(logicalHeight);
    const roundedCurrent = Math.round(currentHeight);
    const roundedLast = lastAutoHeightRef.current ?? null;

    // зөвхөн бодит өөрчлөлт байвал patch хийнэ
    if (
      Math.abs(roundedNext - roundedCurrent) > 2 &&
      roundedLast !== roundedNext
    ) {
      lastAutoHeightRef.current = roundedNext;

      onPatch({
        height: roundedNext,
        heightMm: pxToMm(roundedNext),
      });
    }
  }, [
    element.type,
    element.text,
    element.fontSize,
    element.fontScale,
    element.fontWeight,
    element.fontFamily,
    element.lineHeight,
    element.width,
    element.widthMm,
    scale,
  ]);

  const logicalX = getLogicalX();
  const logicalY = getLogicalY();
  const logicalW = getLogicalW();
  const logicalH = getLogicalH();

  return (
    <div
      onPointerDown={handleBoxPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute touch-none ${
        selected ? "ring-2 ring-blue-500 ring-offset-2" : ""
      }`}
      style={{
        left: (logicalX + previewBleed) * scale,
        top: (logicalY + previewBleed) * scale,
        width: logicalW * scale,
        height: element.type === "text" ? "auto" : logicalH * scale,
        opacity: element.opacity,
        transform: `rotate(${element.rotation}deg)`,
      }}
    >
      {selected && (
        <MiniActionBar
          type={element.type}
          onDelete={onDelete}
          showMoveHandle={element.type === "text"}
          onMovePointerDown={
            element.type === "text" ? handleMoveHandlePointerDown : undefined
          }
        />
      )}

      {element.type === "text" && (
        <>
          <textarea
            ref={textRef}
            rows={1}
            value={element.text ?? ""}
            onFocus={() => {
              textSnapshotRef.current = element.text ?? "";
              onDragStart();
            }}
            onChange={(e) => {
              lastAutoHeightRef.current = null;
              onPatch({ text: e.target.value });
            }}
            onBlur={() => {
              if ((textSnapshotRef.current ?? "") !== (element.text ?? "")) {
                onCommit();
              }
              textSnapshotRef.current = null;
              onDragEnd();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="w-full resize-none border-none bg-transparent outline-none"
            style={{
              color: element.color,
              fontSize: `${(element.fontSize ?? 40) * (element.fontScale ?? 1) * scale}px`,
              fontWeight: element.fontWeight ?? 400,
              fontFamily:
                element.fontFamily ?? "var(--font-inter), Inter, sans-serif",
              textAlign: element.textAlign ?? "left",
              lineHeight: element.lineHeight ?? 1.2,
              textShadow: element.textShadow,
              padding: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              overflow: "hidden",
              width: "100%",
              minWidth: "100%",
              maxWidth: "100%",
              display: "block",
              boxSizing: "border-box",
            }}
            spellCheck={false}
            autoCorrect="off"
          />

          <div
            ref={measureRef}
            style={{
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              width: logicalW * scale,
              fontSize: `${(element.fontSize ?? 40) * (element.fontScale ?? 1) * scale}px`,
              fontWeight: element.fontWeight ?? 400,
              fontFamily:
                element.fontFamily ?? "var(--font-inter), Inter, sans-serif",
              lineHeight: element.lineHeight ?? 1.2,
              boxSizing: "border-box",
              padding: 0,
            }}
          />
        </>
      )}

      {element.type === "logo" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={element.src}
          alt={element.name}
          className={`h-full w-full ${
            element.name === "AI BG" ? "object-cover" : "object-contain"
          }`}
          style={{
            borderRadius: element.borderRadius,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      )}

      {element.type === "line" && (
        <div className="flex h-full w-full items-center">
          <div
            className="w-full"
            style={{
              height: (element.lineThickness ?? logicalH ?? 6) * scale,
              background: element.color,
              borderRadius: 999,
            }}
          />
        </div>
      )}

      {selected && element.name !== "AI BG" && (
        <button
          type="button"
          className="absolute -bottom-2 -right-2 z-20 h-4 w-4 rounded-full bg-blue-500"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          aria-label="Resize"
        />
      )}
    </div>
  );
}

const parseMm = (value: string) => {
  const v = String(value).toLowerCase().trim();

  if (v.endsWith("cm")) return Number(v.replace("cm", "")) * 10;
  if (v.endsWith("m")) return Number(v.replace("m", "")) * 1000;

  return Number(v);
};

export default function EditorShell() {
  const [doc, setDoc] = useState({
    widthMm: 3500,
    heightMm: 1500,
    bleedMm: 5,
    safeMm: 20,
  });

  const [elements, setElements] = useState<EditorElement[]>([]);
  const elementsRef = useRef<EditorElement[]>([]);

  const [history, setHistory] = useState<EditorElement[][]>([]);
  const historyRef = useRef<EditorElement[][]>([]);

  const [future, setFuture] = useState<EditorElement[][]>([]);
  const futureRef = useRef<EditorElement[][]>([]);

  const pendingHistoryRef = useRef<EditorElement[] | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [scale, setScale] = useState(() => getPreviewScale(2000, 1000));
  const [status, setStatus] = useState("Бэлэн");
  const [guides, setGuides] = useState<{
    vertical: number | null;
    horizontal: number | null;
  }>({
    vertical: null,
    horizontal: null,
  });

  const [orderOpen, setOrderOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isDraggingElement, setIsDraggingElement] = useState(false);

  const [showGuides, setShowGuides] = useState(true);
  const [includeCropMarks, setIncludeCropMarks] = useState(false);

  const [settingsPos, setSettingsPos] = useState({ x: 980, y: 220 });
  const settingsDragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    elementsRef.current = JSON.parse(JSON.stringify(elements));
  }, [elements]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    futureRef.current = future;
  }, [future]);

  const cloneElements = (items: EditorElement[]) =>
    JSON.parse(JSON.stringify(items)) as EditorElement[];

  const sameElements = (a: EditorElement[], b: EditorElement[]) =>
    JSON.stringify(a) === JSON.stringify(b);

  const applyElements = (next: EditorElement[]) => {
    const safeNext = cloneElements(Array.isArray(next) ? next : []);
    elementsRef.current = safeNext;
    setElements(safeNext);
  };

  const pushUniqueHistory = (snapshot: EditorElement[]) => {
    const safeSnapshot = cloneElements(snapshot);
    const prev = historyRef.current;
    const last = prev[prev.length - 1];

    if (last && sameElements(last, safeSnapshot)) return;

    const nextHistory = [...prev.slice(-29), safeSnapshot];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  };

  const captureHistoryStart = () => {
    if (!pendingHistoryRef.current) {
      pendingHistoryRef.current = cloneElements(elementsRef.current);
    }
  };

  const commitHistory = () => {
    if (!pendingHistoryRef.current) return;

    if (!sameElements(pendingHistoryRef.current, elementsRef.current)) {
      pushUniqueHistory(pendingHistoryRef.current);
      futureRef.current = [];
      setFuture([]);
    }

    pendingHistoryRef.current = null;
  };

  const pushHistory = (next: EditorElement[]) => {
    pushUniqueHistory(elementsRef.current);
    futureRef.current = [];
    setFuture([]);
    pendingHistoryRef.current = null;
    applyElements(next);
  };

  const patchElement = (id: string, patch: Partial<EditorElement>) => {
    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];

    const nextList = base.map((item) => {
      if (item.id !== id) return item;

      const next: EditorElement = { ...item, ...patch };

      if (patch.x !== undefined) next.xMm = pxToMm(patch.x);
      if (patch.y !== undefined) next.yMm = pxToMm(patch.y);

      if (patch.xMm !== undefined) next.x = mmToPx(patch.xMm);
      if (patch.yMm !== undefined) next.y = mmToPx(patch.yMm);

      if (patch.width !== undefined) next.widthMm = pxToMm(patch.width);
      if (patch.height !== undefined) next.heightMm = pxToMm(patch.height);

      if (patch.widthMm !== undefined) next.width = mmToPx(patch.widthMm);
      if (patch.heightMm !== undefined) next.height = mmToPx(patch.heightMm);

      if (next.type === "logo") {
        const aspectRatio = next.aspectRatio ?? 1;

        if (patch.width !== undefined && patch.height === undefined) {
          next.height = Math.round(next.width / aspectRatio);
          next.heightMm = pxToMm(next.height);
        }

        if (patch.height !== undefined && patch.width === undefined) {
          next.width = Math.round(next.height * aspectRatio);
          next.widthMm = pxToMm(next.width);
        }
      }

      if (next.type === "line") {
        const thickness =
          patch.lineThickness ??
          patch.height ??
          next.lineThickness ??
          next.height ??
          6;

        next.lineThickness = thickness;
        next.height = thickness;
        next.heightMm = pxToMm(thickness);
      }

      return next;
    });

    applyElements(nextList);
  };

  const selected = useMemo(
    () =>
      (Array.isArray(elements) ? elements : []).find(
        (item) => item.id === selectedId,
      ) ?? null,
    [elements, selectedId],
  );

  const previewCanvasWidth = mmToPx(Number(doc.widthMm) || 3500);
  const previewCanvasHeight = mmToPx(Number(doc.heightMm) || 1500);
  const previewBleed = mmToPx(Number(doc.bleedMm) || 0);
  const previewSafe = mmToPx(Number(doc.safeMm) || 0);
  const previewTotalWidth = previewCanvasWidth + previewBleed * 2;
  const previewTotalHeight = previewCanvasHeight + previewBleed * 2;

  const currentFontSize = selected?.fontSize ?? 40;

  const fontSizeControlMin =
    selected?.role === "primary" ? 24 : selected?.role === "contact" ? 14 : 12;

  const selectedLogicalX =
    selected?.xMm !== undefined ? mmToPx(selected.xMm) : (selected?.x ?? 0);

  const selectedLogicalY =
    selected?.yMm !== undefined ? mmToPx(selected.yMm) : (selected?.y ?? 0);

  const selectedLogicalWidth =
    selected?.widthMm !== undefined
      ? mmToPx(selected.widthMm)
      : (selected?.width ?? 300);

  const safeAreaFitMaxFontSize =
    selected?.type === "text"
      ? getSafeAreaFitMaxFontSize({
          text: selected.text ?? "",
          widthPx: selectedLogicalWidth,
          currentX: selectedLogicalX,
          currentY: selectedLogicalY,
          docWidth: previewCanvasWidth,
          docHeight: previewCanvasHeight,
          previewSafe,
          fontWeight: selected.fontWeight ?? 700,
          lineHeight: selected.lineHeight ?? 1.2,
          role: selected.role,
        })
      : 220;

  const fontSizeControlMax = Math.max(
    fontSizeControlMin,
    safeAreaFitMaxFontSize,
    Math.ceil(currentFontSize),
  );

  const fontSizeControlStep = 1;
  const addText = (role: TextRole = "support") => {
    const el = createTextElement(previewCanvasWidth, "Шинэ текст");
    el.role = role;

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    pushHistory([...base, el]);
    setSelectedId(el.id);
  };

  const addLine = () => {
    const el = createLineElement();

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    pushHistory([...base, el]);
    setSelectedId(el.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    const next = base.filter((el) => el.id !== selectedId);

    pushHistory(next);
    setSelectedId(null);
  };

  const changeRole = (role: TextRole) => {
    if (!selected) {
      addText(role);
      return;
    }

    captureHistoryStart();

    const base = Array.isArray(elementsRef.current) ? elementsRef.current : [];
    const next = base.map((el) =>
      el.id === selected.id ? { ...el, role } : el,
    );

    applyElements(next);
    commitHistory();
  };

  const updateSelected = (patch: Partial<EditorElement>) => {
    if (!selectedId) return;
    patchElement(selectedId, patch);
  };

  const beginSelectedEdit = () => {
    if (!selectedId) return;
    captureHistoryStart();
  };

  const finishSelectedEdit = () => {
    commitHistory();
  };

  const undo = () => {
    const prevHistory = historyRef.current;
    const last = prevHistory[prevHistory.length - 1];
    if (!last) return;

    const current = cloneElements(elementsRef.current);
    const nextFuture = [current, ...futureRef.current];

    futureRef.current = nextFuture;
    setFuture(nextFuture);

    const nextHistory = prevHistory.slice(0, -1);
    historyRef.current = nextHistory;
    setHistory(nextHistory);

    pendingHistoryRef.current = null;
    setSelectedId(null);
    applyElements(last);
  };

  const redo = () => {
    const next = futureRef.current[0];
    if (!next) return;

    const current = cloneElements(elementsRef.current);
    const nextHistory = [...historyRef.current, current];
    const nextFuture = futureRef.current.slice(1);

    historyRef.current = nextHistory;
    futureRef.current = nextFuture;

    setHistory(nextHistory);
    setFuture(nextFuture);

    pendingHistoryRef.current = null;
    setSelectedId(null);
    applyElements(next);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();
      const isTyping =
        tag === "textarea" || tag === "input" || active?.isContentEditable;

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        !isTyping
      ) {
        e.preventDefault();
        deleteSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [selectedId]);

  const extractClientFallback = (prompt: string) => {
    const lines = prompt
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    let headline = "";
    let subtitle = "";
    let cta = "";

    for (const line of lines) {
      if (!headline && /гарчиг|headline|голд нь/i.test(line)) {
        const cleaned = line
          .replace(/.*?(гарчигтай|гарчиг|headline|голд нь)\s*/i, "")
          .replace(/^[:\-–—]\s*/, "")
          .replace(/гэж\s+бич\.?$/i, "")
          .trim();
        if (cleaned) headline = cleaned;
      }

      if (!subtitle && /доор нь|subtitle|coffee|dessert|brunch/i.test(line)) {
        const cleaned = line
          .replace(/.*?(доор нь|subtitle)\s*/i, "")
          .replace(/^[:\-–—]\s*/, "")
          .replace(/гэж\s+бич\.?$/i, "")
          .trim();
        if (cleaned) subtitle = cleaned;
      }

      if (!cta && /утас|phone|call/i.test(line)) {
        const cleaned = line
          .replace(/.*?(утас|phone|call)\s*[:：]?\s*/i, "")
          .trim();
        if (cleaned) cta = /^утас/i.test(line) ? `Утас: ${cleaned}` : cleaned;
      }
    }

    if (!headline) {
      const m = prompt.match(/([A-ZА-ЯӨҮЁ][A-ZА-ЯӨҮЁa-zа-яөүё\s]{3,40})/);
      if (m) headline = m[1].trim();
    }

    if (!subtitle) {
      const m = prompt.match(
        /(Coffee.*|Dessert.*|Brunch.*|Coffee\s*[•*·-]\s*Dessert.*)/i,
      );
      if (m) subtitle = m[1].replace(/\s+/g, " ").trim();
    }

    if (!cta) {
      const m = prompt.match(/(\d{6,12})/);
      if (m) cta = `Утас: ${m[1]}`;
    }

    return { headline, subtitle, cta };
  };

  const runAiText = async () => {
    if (!aiPrompt.trim()) return;

    try {
      setStatus("AI дизайн үүсгэж байна...");

      const res = await fetch("/api/ai/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          widthMm: doc.widthMm,
          heightMm: doc.heightMm,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "AI алдаа гарлаа");
        setStatus("AI алдаа");
        return;
      }

      const apiLayout = data.layout ?? {};
      const fallback = extractClientFallback(aiPrompt);

      const cleanHex = (value: unknown, fallbackColor: string) => {
        if (typeof value !== "string") return fallbackColor;
        const v = value.trim();
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallbackColor;
      };

      const headlineColor = cleanHex(apiLayout.headlineColor, "#f8fafc");
      const subtitleColor = cleanHex(apiLayout.subtitleColor, headlineColor);
      const ctaColor = cleanHex(apiLayout.ctaColor, headlineColor);

      const removeStyleWords = (text: string) => {
        return text
          .replace(
            /\b(luxury|minimal|minimalist|premium|modern|elegant|style)\b/gi,
            "",
          )
          .replace(/\s{2,}/g, " ")
          .replace(/[.,;:]+\s*$/g, "")
          .trim();
      };

      const extractPhone = (text: string) => {
        const match = text.match(/(\+?\d[\d\s-]{5,})/);
        return match ? match[1].trim() : "";
      };

      const removePhoneLine = (text: string) => {
        return text
          .replace(/утас\s*[:：]?\s*\+?\d[\d\s-]{5,}/gi, "")
          .replace(/\+?\d[\d\s-]{5,}/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/[•*·]\s*[•*·]+/g, " • ")
          .replace(/[.,;:]+\s*$/g, "")
          .trim();
      };

      const _headline = removeStyleWords(
        String(apiLayout.headline || fallback.headline || "").trim(),
      );
      const _rawSubtitle = removeStyleWords(
        String(apiLayout.subtitle || fallback.subtitle || "").trim(),
      );
      const _rawCta = removeStyleWords(
        String(apiLayout.cta || fallback.cta || "").trim(),
      );

      const _subtitle = removePhoneLine(_rawSubtitle);
      const phoneValue =
        extractPhone(_rawCta) ||
        extractPhone(_rawSubtitle) ||
        extractPhone(aiPrompt);
      const _cta = phoneValue ? `Утас: ${phoneValue}` : "";

      void _headline;
      void _subtitle;
      void _cta;

      const nextElements: EditorElement[] = [];

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
          widthMm: doc.widthMm,
          heightMm: doc.heightMm,
          rotation: 0,
          opacity: 1,
          src: data.image,
          borderRadius: 0,
          aspectRatio: previewCanvasWidth / previewCanvasHeight,
        });
      }

      const safeLeft = previewCanvasWidth * 0.18;
      const safeWidth = previewCanvasWidth * 0.64;

      const layoutType: "center" | "left" | "stack" = (
        ["center", "left", "stack"] as const
      )[Math.floor(Math.random() * 3)];

      const texts: any[] = Array.isArray(data.texts) ? data.texts : [];

      const totalHeight = texts.reduce((sum, t: any) => {
        const sourceRole =
          t.role === "headline" || t.role === "cta" ? t.role : "line";

        const mappedRole: TextRole =
          sourceRole === "headline"
            ? "primary"
            : sourceRole === "cta"
              ? "contact"
              : "secondary";

        const cfg = getRoleLayoutConfig(
          mappedRole,
          previewCanvasWidth,
          previewCanvasHeight,
        );

        return sum + cfg.boxHeight + cfg.gap;
      }, 0);

      let currentY =
        layoutType === "stack"
          ? (previewCanvasHeight - totalHeight) / 2 - previewCanvasHeight * 0.01
          : layoutType === "left"
            ? (previewCanvasHeight - totalHeight) / 2 -
              previewCanvasHeight * 0.02
            : (previewCanvasHeight - totalHeight) / 2 -
              previewCanvasHeight * 0.03;

      texts.forEach((t: any) => {
        const sourceRole =
          t.role === "headline" || t.role === "cta" ? t.role : "line";

        const mappedRole: TextRole =
          sourceRole === "headline"
            ? "primary"
            : sourceRole === "cta"
              ? "contact"
              : "secondary";

        const rawText = String(t.text || "").trim();
        if (!rawText) return;

        const cfg = getRoleLayoutConfig(
          mappedRole,
          previewCanvasWidth,
          previewCanvasHeight,
        );

        const boxHeight = cfg.boxHeight;
        const gap = cfg.gap;

        const safeFontSize = fitFontSizeSmart(
          rawText,
          mappedRole,
          safeWidth,
          boxHeight,
          previewCanvasWidth,
          previewCanvasHeight,
        );

        const textX =
          layoutType === "left"
            ? safeLeft + previewCanvasWidth * 0.009
            : layoutType === "stack"
              ? previewCanvasWidth / 2 - safeWidth / 2
              : safeLeft;

        const textY =
          mappedRole === "primary"
            ? currentY - previewCanvasHeight * 0.015
            : currentY;

        const textAlign: "left" | "center" | "right" =
          layoutType === "left" ? "left" : "center";

        nextElements.push({
          id: makeId(),
          type: "text",
          name:
            mappedRole === "primary"
              ? "Primary"
              : mappedRole === "contact"
                ? "Contact"
                : mappedRole === "secondary"
                  ? "Secondary"
                  : "Support",
          role: mappedRole,
          text: rawText,
          x: textX,
          y: textY,
          xMm: pxToMm(textX),
          yMm: pxToMm(textY),
          width: safeWidth,
          height: boxHeight,
          widthMm: pxToMm(safeWidth),
          heightMm: pxToMm(boxHeight),
          rotation: 0,
          opacity: 1,
          color:
            typeof t.color === "string" && t.color.trim()
              ? t.color.trim()
              : mappedRole === "primary"
                ? headlineColor
                : mappedRole === "contact"
                  ? ctaColor
                  : subtitleColor,
          fontSize: safeFontSize,
          fontScale: 1,
          fontWeight: cfg.fontWeight,
          fontFamily: "var(--font-inter), Inter, sans-serif",
          textAlign,
          lineHeight: cfg.lineHeight,
          borderRadius: 0,
          textShadow: "0 2px 8px rgba(0,0,0,0.18)",
        });

        currentY +=
          layoutType === "stack" ? boxHeight + gap * 1.35 : boxHeight + gap;
      });

      const safeElements = Array.isArray(elementsRef.current)
        ? elementsRef.current
        : [];

      const userLogos = safeElements.filter(
        (e) => e.type === "logo" && e.name !== "AI BG",
      );
      const bg = nextElements.find((e) => e.name === "AI BG");
      const textEls = nextElements.filter((e) => e.name !== "AI BG");
      const next = bg
        ? [bg, ...textEls, ...userLogos]
        : [...textEls, ...userLogos];

      pushHistory(next);
      setSelectedId(textEls[0]?.id ?? userLogos[0]?.id ?? null);
      setStatus("AI дизайн бэлэн");
    } catch (error) {
      console.error(error);
      setStatus("AI алдаа");
      alert("AI дизайн үүсгэхэд алдаа гарлаа");
    }
  };

  const handleLogoUpload = async (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxWidth = 320;
        const aspectRatio = img.width / img.height;
        const width = maxWidth;
        const height = Math.round(width / aspectRatio);

        const logoElement: EditorElement = {
          id: makeId(),
          type: "logo",
          name: "Лого",
          x: 120,
          y: 360,
          width,
          height,
          xMm: pxToMm(120),
          yMm: pxToMm(360),
          widthMm: pxToMm(width),
          heightMm: pxToMm(height),
          rotation: 0,
          opacity: 1,
          src: String(reader.result),
          aspectRatio,
          borderRadius: 0,
        };

        const safeElements = Array.isArray(elementsRef.current)
          ? elementsRef.current
          : [];
        pushHistory([...safeElements, logoElement]);
        setSelectedId(logoElement.id);
        setStatus("Лого орлоо");

        if (logoInputRef.current) {
          logoInputRef.current.value = "";
        }
      };

      img.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  };

  function drawCropMarks(
    pdf: jsPDF,
    width: number,
    height: number,
    bleed: number,
  ) {
    const markLength = 5;
    const offset = 2;

    const left = bleed;
    const right = width - bleed;
    const top = bleed;
    const bottom = height - bleed;

    pdf.setLineWidth(0.2);

    pdf.line(
      left - offset - markLength,
      top - offset,
      left - offset,
      top - offset,
    );
    pdf.line(
      left - offset,
      top - offset - markLength,
      left - offset,
      top - offset,
    );

    pdf.line(
      right + offset,
      top - offset,
      right + offset + markLength,
      top - offset,
    );
    pdf.line(
      right + offset,
      top - offset - markLength,
      right + offset,
      top - offset,
    );

    pdf.line(
      left - offset - markLength,
      bottom + offset,
      left - offset,
      bottom + offset,
    );
    pdf.line(
      left - offset,
      bottom + offset,
      left - offset,
      bottom + offset + markLength,
    );

    pdf.line(
      right + offset,
      bottom + offset,
      right + offset + markLength,
      bottom + offset,
    );
    pdf.line(
      right + offset,
      bottom + offset,
      right + offset,
      bottom + offset + markLength,
    );
  }

  const buildVectorPdf = async (scaleFactor = 1) => {
    const pageWidth = (doc.widthMm + doc.bleedMm * 2) / scaleFactor;
    const pageHeight = (doc.heightMm + doc.bleedMm * 2) / scaleFactor;

    const pdf = new jsPDF({
      orientation: pageWidth >= pageHeight ? "landscape" : "portrait",
      unit: "mm",
      format: [pageWidth, pageHeight],
      compress: true,
    });

    await initPdfFonts(pdf);

    for (const el of Array.isArray(elements) ? elements : []) {
      const x =
        (doc.bleedMm + (el.xMm !== undefined ? el.xMm : pxToMm(el.x))) /
        scaleFactor;

      const y =
        (doc.bleedMm + (el.yMm !== undefined ? el.yMm : pxToMm(el.y))) /
        scaleFactor;

      const width =
        (el.widthMm !== undefined ? el.widthMm : pxToMm(el.width)) /
        scaleFactor;

      const height =
        (el.heightMm !== undefined ? el.heightMm : pxToMm(el.height)) /
        scaleFactor;

      if (el.type === "text" && el.text) {
        const fontSizePt = fontPxToPt(
          (el.fontSize ?? 40) * (el.fontScale ?? 1),
        );
        const align = getPdfTextAlign(el.textAlign);

        pdf.setFont(
          "NotoSans",
          (el.fontWeight ?? 400) >= 700 ? "bold" : "normal",
        );

        pdf.setFontSize(fontSizePt);
        pdf.setTextColor(el.color ?? "#000000");

        const textX =
          align === "center"
            ? x + width / 2
            : align === "right"
              ? x + width
              : x;

        const lines = pdf.splitTextToSize(el.text, width);

        pdf.text(lines, textX, y, {
          align,
          baseline: "top",
          lineHeightFactor: el.lineHeight ?? 1.2,
        });
      }

      if (el.type === "line") {
        pdf.setDrawColor(el.color ?? "#000000");
        pdf.setLineWidth(
          Math.max(
            0.2,
            pxToMm(el.lineThickness ?? el.height ?? 6) / scaleFactor,
          ),
        );
        pdf.line(x, y + height / 2, x + width, y + height / 2);
      }

      if (el.type === "logo" && el.src) {
        const format =
          el.src.includes("image/jpeg") || el.src.includes("image/jpg")
            ? "JPEG"
            : "PNG";

        pdf.addImage(el.src, format, x, y, width, height);
      }
    }

    if (includeCropMarks) {
      drawCropMarks(pdf, pageWidth, pageHeight, doc.bleedMm / scaleFactor);
    }

    if (scaleFactor > 1) {
      pdf.setTextColor(200, 200, 200);
      pdf.setFontSize(80 / scaleFactor);

      pdf.text("NEGUN DESIGN", pageWidth / 2, pageHeight / 2, {
        align: "center",
      });

      pdf.setFontSize(40 / scaleFactor);

      pdf.text("SCALE 1:10", pageWidth / 2, pageHeight / 2 + 10, {
        align: "center",
      });
    }

    return pdf;
  };

  const buildPreviewImage = async () => {
    if (!surfaceRef.current) return null;

    const dataUrl = await toPng(surfaceRef.current, {
      cacheBust: true,
      pixelRatio: 2,
    });

    return dataUrl;
  };

  const handleOrder = async () => {
    if (!name || !phone) {
      alert("Нэр, утсаа оруулна уу");
      return;
    }

    if (!surfaceRef.current) return;

    setStatus("PDF илгээж байна...");

    try {
      const pdf = await buildVectorPdf();
      if (!pdf) throw new Error("Print PDF үүссэнгүй");

      const pdfBlob = pdf.output("blob");

      const scaledPdf = await buildVectorPdf(10);
      if (!scaledPdf) throw new Error("Scaled PDF үүссэнгүй");

      const scaledPdfBlob = scaledPdf.output("blob");
      const previewImage = await buildPreviewImage();

      const formData = new FormData();
      formData.append("name", name);
      formData.append("phone", phone);
      formData.append("file", pdfBlob, "design-print.pdf");
      formData.append("scaledPdf", scaledPdfBlob, "design-scaled.pdf");

      if (previewImage) {
        const previewRes = await fetch(previewImage);
        const previewBlob = await previewRes.blob();
        formData.append("preview", previewBlob, "design-preview.png");
      }

      const res = await fetch("/api/send-order", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        alert("Амжилттай илгээгдлээ!");
        setOrderOpen(false);
        setName("");
        setPhone("");
      } else {
        alert(data.error || "Алдаа гарлаа");
      }

      setStatus("PDF илгээгдлээ");
    } catch (error) {
      console.error("ORDER ERROR:", error);

      const message =
        error instanceof Error ? error.message : JSON.stringify(error);

      alert(`Илгээх үед алдаа гарлаа:\n${message}`);
      setStatus("Алдаа гарлаа");
    }
  };

  const exportToPDF = async () => {
    try {
      setStatus("PDF үүсгэж байна...");

      const pdf = await buildVectorPdf();
      if (!pdf) return;

      pdf.save("design.pdf");
      setStatus("PDF бэлэн");
    } catch (err) {
      console.error(err);
      alert("PDF үүсгэхэд алдаа гарлаа");
      setStatus("Алдаа");
    }
  };

  const handleSettingsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    settingsDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: settingsPos.x,
      baseY: settingsPos.y,
    };

    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleSettingsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!settingsDragRef.current) return;

    const dx = e.clientX - settingsDragRef.current.startX;
    const dy = e.clientY - settingsDragRef.current.startY;

    setSettingsPos({
      x: settingsDragRef.current.baseX + dx,
      y: settingsDragRef.current.baseY + dy,
    });
  };

  const handleSettingsPointerUp = () => {
    settingsDragRef.current = null;
  };

  return (
    <main
      className="min-h-screen bg-slate-100 text-slate-900"
      onPointerDown={() => {
        setSelectedId(null);
      }}
    >
      <div className="mx-auto grid max-w-[1700px] gap-4 p-3 md:grid-cols-[360px_minmax(0,1fr)] md:p-4">
        <aside className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="text-lg font-bold text-slate-900">
            AI текст үүсгэх
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Зар, нэрийн хуудас, танилцуулгын текстээ бичүүлээрэй.
          </p>

          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Жишээ: Монгол хэл дээр гоо сайхны салбарын хямдралын постерын текст бичиж өг"
            className="mt-4 min-h-36 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none transition focus:border-blue-500"
          />

          <button
            onClick={runAiText}
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            <Wand2 className="h-4 w-4" />
            AI текст үүсгэх
          </button>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="text-lg font-bold text-slate-900">
              Хэвлэлийн хэмжээ
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Document-ийн бодит хэмжээг мм-ээр оруулна.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span>Өргөн (mm)</span>
                <input
                  type="text"
                  value={doc.widthMm}
                  placeholder="мм (жишээ: 3500)"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDoc((prev) => ({
                      ...prev,
                      widthMm: e.target.value as any,
                    }))
                  }
                  onBlur={(e) => {
                    const mm = parseMm(e.target.value);
                    setDoc((prev) => ({
                      ...prev,
                      widthMm: !isNaN(mm) ? Math.max(100, mm) : 3500,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Өндөр (mm)</span>
                <input
                  type="text"
                  value={doc.heightMm}
                  placeholder="мм (жишээ: 1500)"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDoc((prev) => ({
                      ...prev,
                      heightMm: e.target.value as any,
                    }))
                  }
                  onBlur={(e) => {
                    const mm = parseMm(e.target.value);
                    setDoc((prev) => ({
                      ...prev,
                      heightMm: !isNaN(mm) ? Math.max(100, mm) : 1500,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Илүүдэл зай (mm)</span>
                <input
                  type="text"
                  value={doc.bleedMm}
                  placeholder="мм"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDoc((prev) => ({
                      ...prev,
                      bleedMm: e.target.value as any,
                    }))
                  }
                  onBlur={(e) => {
                    const mm = parseMm(e.target.value);
                    setDoc((prev) => ({
                      ...prev,
                      bleedMm: !isNaN(mm) ? Math.max(0, mm) : 5,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Аюулгүй бүс (mm)</span>
                <input
                  type="text"
                  value={doc.safeMm}
                  placeholder="мм"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setDoc((prev) => ({
                      ...prev,
                      safeMm: e.target.value as any,
                    }))
                  }
                  onBlur={(e) => {
                    const mm = parseMm(e.target.value);
                    setDoc((prev) => ({
                      ...prev,
                      safeMm: !isNaN(mm) ? Math.max(0, mm) : 20,
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="text-lg font-bold text-slate-900">Лого оруулах</div>
            <p className="mt-1 text-sm text-slate-500">
              PNG, JPG логогоо canvas дээр нэмнэ.
            </p>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
            />

            <button
              onClick={() => logoInputRef.current?.click()}
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ImagePlus className="h-4 w-4" />
              Лого upload
            </button>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">
                Харагдац ба экспорт
              </div>

              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showGuides}
                  onChange={(e) => setShowGuides(e.target.checked)}
                />
                <span>Чиглүүлэгч шугам харуулах</span>
              </label>

              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeCropMarks}
                  onChange={(e) => setIncludeCropMarks(e.target.checked)}
                />
                <span>Тайрах тэмдэг оруулах</span>
              </label>

              <p className="mt-3 text-xs text-slate-500">
                Чиглүүлэгч шугам нь зөвхөн edit дээр харагдана. Тайрах тэмдэг нь
                PDF дээр хүсвэл л орно.
              </p>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Төлөв</div>
              <div className="mt-1">{status}</div>
              <div className="mt-1 text-xs text-slate-500">
                Export quality: {EXPORT_DPI} DPI
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Size: {doc.widthMm} × {doc.heightMm} mm
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Bleed: {doc.bleedMm} mm · Safe area: {doc.safeMm} mm
              </div>
            </div>
          </div>
        </aside>

        <section
          className="rounded-3xl bg-white p-3 shadow-sm md:p-4"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedId(null);
            }
          }}
        >
          <div
            className="relative overflow-auto rounded-3xl bg-slate-100 p-4"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedId(null);
              }
            }}
          >
            <div className="absolute left-1/2 top-4 z-20 w-[min(calc(100%-16px),900px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ToolbarButton icon={Undo2} label="Буцаах" onClick={undo} />
                <ToolbarButton icon={Redo2} label="Дахин" onClick={redo} />
                <ToolbarButton
                  icon={Type}
                  label="Текст"
                  onClick={() => changeRole("support")}
                />
                <ToolbarButton
                  icon={PanelTopClose}
                  label="Шугам"
                  onClick={addLine}
                />

                <div className="mx-1 hidden h-8 w-px bg-slate-200 md:block" />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setScale((prev) => Math.max(prev - 0.01, 0.01))
                    }
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="min-w-14 text-center text-sm font-semibold">
                    {Math.round(scale * 100)}%
                  </span>

                  <button
                    onClick={() => setScale((prev) => Math.min(prev + 0.01, 3))}
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <ToolbarButton
                  icon={Printer}
                  label="PDF"
                  onClick={exportToPDF}
                />

                <ToolbarButton
                  icon={Printer}
                  label="Хэвлүүлэх"
                  onClick={() => setOrderOpen(true)}
                  variant="primary"
                />
              </div>
            </div>

            <div
              className="relative mx-auto flex min-h-[75vh] items-start justify-center pt-24"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                }
              }}
            >
              <div
                className="relative"
                style={{
                  width: previewTotalWidth * scale,
                  height: previewTotalHeight * scale,
                }}
              >
                {showGuides && (
                  <div
                    className="pointer-events-none absolute border border-red-500"
                    style={{
                      left: 0,
                      top: 0,
                      width: previewTotalWidth * scale,
                      height: previewTotalHeight * scale,
                    }}
                  />
                )}

                {showGuides && (
                  <div
                    className="pointer-events-none absolute z-20 border-2 border-dashed border-blue-500"
                    style={{
                      left: (previewBleed + previewSafe) * scale,
                      top: (previewBleed + previewSafe) * scale,
                      width: (previewCanvasWidth - previewSafe * 2) * scale,
                      height: (previewCanvasHeight - previewSafe * 2) * scale,
                    }}
                  />
                )}

                <div
                  ref={surfaceRef}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedId(null);
                    }
                  }}
                  className="absolute overflow-visible rounded-[30px] border border-slate-200 bg-white shadow-xl"
                  style={{
                    width: previewTotalWidth * scale,
                    height: previewTotalHeight * scale,
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[30px]"
                    style={{
                      boxShadow: `inset 0 0 0 ${previewBleed * scale}px rgba(239, 68, 68, 0.06)`,
                    }}
                  />

                  {(Array.isArray(elements) ? elements : []).map((item) => (
                    <CanvasItem
                      key={item.id}
                      element={item}
                      scale={scale}
                      selected={item.id === selectedId}
                      docWidth={previewCanvasWidth}
                      docHeight={previewCanvasHeight}
                      previewBleed={previewBleed}
                      previewSafe={previewSafe}
                      onSelect={() => setSelectedId(item.id)}
                      onDelete={() => {
                        const base = Array.isArray(elementsRef.current)
                          ? elementsRef.current
                          : [];
                        const next = base.filter((el) => el.id !== item.id);
                        setSelectedId(null);
                        pushHistory(next);
                      }}
                      onPatch={(patch) => {
                        patchElement(item.id, patch);
                      }}
                      onCommit={commitHistory}
                      onDragStart={() => {
                        captureHistoryStart();
                        setIsDraggingElement(true);
                      }}
                      onDragEnd={() => {
                        setIsDraggingElement(false);
                      }}
                      onGuidesChange={(nextGuides) => {
                        setGuides({
                          vertical:
                            nextGuides.vertical !== null
                              ? nextGuides.vertical + previewBleed
                              : null,
                          horizontal:
                            nextGuides.horizontal !== null
                              ? nextGuides.horizontal + previewBleed
                              : null,
                        });
                      }}
                    />
                  ))}

                  {guides.vertical !== null && (
                    <div
                      className="pointer-events-none absolute top-0 z-30"
                      style={{
                        left: guides.vertical * scale,
                        width: 2,
                        height: previewTotalHeight * scale,
                        backgroundColor: GUIDE_COLOR,
                        opacity: 1,
                        boxShadow: `0 0 0 1px ${GUIDE_COLOR}33, 0 0 8px ${GUIDE_COLOR}66`,
                      }}
                    />
                  )}

                  {guides.horizontal !== null && (
                    <div
                      className="pointer-events-none absolute left-0 z-30"
                      style={{
                        top: guides.horizontal * scale,
                        height: 2,
                        width: previewTotalWidth * scale,
                        backgroundColor: GUIDE_COLOR,
                        opacity: 1,
                        boxShadow: `0 0 0 1px ${GUIDE_COLOR}33, 0 0 8px ${GUIDE_COLOR}66`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {selected && !isDraggingElement && (
        <div
          className="fixed z-40 w-[300px] rounded-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur"
          style={{
            left: settingsPos.x,
            top: settingsPos.y,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onPointerDown={handleSettingsPointerDown}
            onPointerMove={handleSettingsPointerMove}
            onPointerUp={handleSettingsPointerUp}
            className="flex cursor-move items-center justify-between rounded-t-3xl border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900"
          >
            <div className="inline-flex items-center gap-2">
              <Move className="h-4 w-4" />
              Тохиргоо
            </div>

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedId(null);
              }}
              type="button"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Хаах"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="grid gap-3">
              {(selected.type === "text" || selected.type === "line") && (
                <label className="grid gap-1 text-sm">
                  <span>Өнгө</span>
                  <SafeColorInput
                    value={selected.color ?? "#0f172a"}
                    onStart={beginSelectedEdit}
                    onChange={(value) => updateSelected({ color: value })}
                    onCommit={finishSelectedEdit}
                  />
                </label>
              )}

              {selected.type === "text" && (
                <>
                  <label className="grid gap-1 text-sm">
                    <span>Фонт</span>
                    <select
                      value={
                        selected.fontFamily ??
                        "var(--font-inter), Inter, sans-serif"
                      }
                      onChange={(e) => {
                        const base = Array.isArray(elementsRef.current)
                          ? elementsRef.current
                          : [];
                        const next = base.map((item) =>
                          item.id === selected.id
                            ? { ...item, fontFamily: e.target.value }
                            : item,
                        );
                        pushHistory(next);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-2 flex items-center gap-2">
                    {[
                      { value: "left", icon: AlignLeft, label: "left" },
                      { value: "center", icon: AlignCenter, label: "center" },
                      { value: "right", icon: AlignRight, label: "right" },
                    ].map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => {
                          const base = Array.isArray(elementsRef.current)
                            ? elementsRef.current
                            : [];
                          const next = base.map((item) =>
                            item.id === selected.id
                              ? {
                                  ...item,
                                  textAlign: value as
                                    | "left"
                                    | "center"
                                    | "right",
                                }
                              : item,
                          );
                          pushHistory(next);
                        }}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                          (selected.textAlign ?? "left") === value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        aria-label={label}
                        title={label}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}

                    <button
                      onClick={() => {
                        const base = Array.isArray(elementsRef.current)
                          ? elementsRef.current
                          : [];
                        const next = base.map((item) =>
                          item.id === selected.id
                            ? {
                                ...item,
                                fontWeight:
                                  (selected.fontWeight ?? 700) >= 700
                                    ? 400
                                    : 800,
                              }
                            : item,
                        );
                        pushHistory(next);
                      }}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        (selected.fontWeight ?? 700) >= 700
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      aria-label="bold"
                      title="bold"
                      type="button"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <Range
                      label="Мөр хооронд зай"
                      value={selected.lineHeight ?? 1.2}
                      min={1}
                      max={2}
                      step={0.05}
                      onStart={beginSelectedEdit}
                      onChange={(value) =>
                        updateSelected({ lineHeight: value })
                      }
                      onCommit={finishSelectedEdit}
                    />
                  </div>

                  <Range
                    label="Үсгийн хэмжээ (px)"
                    value={selected.fontSize ?? 40}
                    min={fontSizeControlMin}
                    max={fontSizeControlMax}
                    step={fontSizeControlStep}
                    onStart={beginSelectedEdit}
                    onChange={(value) =>
                      updateSelected({
                        fontSize: Math.min(value, fontSizeControlMax),
                        fontScale: 1,
                      })
                    }
                    onCommit={finishSelectedEdit}
                  />
                </>
              )}

              {selected.type === "line" && (
                <>
                  <Range
                    label="Шугамын урт"
                    value={selected.width}
                    min={80}
                    max={900}
                    onStart={beginSelectedEdit}
                    onChange={(value) => updateSelected({ width: value })}
                    onCommit={finishSelectedEdit}
                  />
                  <Range
                    label="Шугамын зузаан"
                    value={selected.lineThickness ?? 6}
                    min={2}
                    max={30}
                    onStart={beginSelectedEdit}
                    onChange={(value) =>
                      updateSelected({ lineThickness: value, height: value })
                    }
                    onCommit={finishSelectedEdit}
                  />
                </>
              )}

              {selected.type === "logo" && (
                <Range
                  label="Өргөн"
                  value={selected.width}
                  min={60}
                  max={900}
                  onStart={beginSelectedEdit}
                  onChange={(value) => updateSelected({ width: value })}
                  onCommit={finishSelectedEdit}
                />
              )}

              <Range
                label="Тунгалагшил"
                value={(selected.opacity ?? 1) * 100}
                min={0}
                max={100}
                step={1}
                onStart={beginSelectedEdit}
                onChange={(value) => updateSelected({ opacity: value / 100 })}
                onCommit={finishSelectedEdit}
              />
            </div>
          </div>
        </div>
      )}

      {orderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Захиалга илгээх</h2>

            <input
              placeholder="Нэр"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 p-3"
            />

            <input
              placeholder="Утас"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 p-3"
            />

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleOrder}
                type="button"
                className="flex-1 rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700"
              >
                Илгээх
              </button>

              <button
                onClick={() => setOrderOpen(false)}
                type="button"
                className="flex-1 rounded-xl border border-slate-200 py-3 font-medium"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
