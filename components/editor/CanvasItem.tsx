"use client";

import React, { memo, useLayoutEffect, useRef } from "react";
import { Move, Trash2 } from "lucide-react";
import type { EditorElement, ElementType } from "./editor-types";
import { SNAP_DISTANCE, clamp, mmToPx, pxToMm } from "./editor-utils";

function getImageBrightness(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return 255;

  const size = 40; // 🔥 downscale (performance)

  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(img, 0, 0, size, size);

  const data = ctx.getImageData(0, 0, size, size).data;

  let r = 0,
    g = 0,
    b = 0;
  const count = size * size;

  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }

  r /= count;
  g /= count;
  b /= count;

  return (r * 299 + g * 587 + b * 114) / 1000;
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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const latestDragPatchRef = useRef<Partial<EditorElement> | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    changed: boolean;
  } | null>(null);
  const lastGuideUpdateRef = useRef(0);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    baseW: number;
    baseH: number;
    changed: boolean;
  } | null>(null);

  const bgImageRef = useRef<HTMLImageElement | null>(null);
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
    latestDragPatchRef.current = null;
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

    latestDragPatchRef.current = {
      x: snappedX,
      y: snappedY,
      xMm: pxToMm(snappedX),
      yMm: pxToMm(snappedY),
    };

    if (boxRef.current) {
      boxRef.current.style.left = `${(snappedX + previewBleed) * scale}px`;
      boxRef.current.style.top = `${(snappedY + previewBleed) * scale}px`;
    }
    const now = performance.now();

    if (now - lastGuideUpdateRef.current > 50) {
      lastGuideUpdateRef.current = now;

      onGuidesChange({
        vertical: verticalGuide,
        horizontal: horizontalGuide,
      });
    }
  };

  const handlePointerUp = () => {
    if (dragRef.current?.changed && latestDragPatchRef.current) {
      onPatch(latestDragPatchRef.current);
      onCommit();
    }

    latestDragPatchRef.current = null;
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
      if (textRef.current) {
        textRef.current.style.height = `${nextHeight * scale}px`;
      }

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

  const lastAutoSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  const logicalX = getLogicalX();
  const logicalY = getLogicalY();
  const logicalW = getLogicalW();
  const logicalH = getLogicalH();

  // 🔥 SHADOW + AUTO CONTRAST ENGINE

  const fontSize = (element.fontSize ?? 40) * (element.fontScale ?? 1);

  // AI shadow strength
  let shadowStrength = (element as any).shadowStrength ?? 0.7;

  // role tweak
  if (element.role === "primary") shadowStrength = 0.85;
  if (element.role === "contact") shadowStrength = 0.5;
  let bgBrightness = 255;
  if (bgImageRef.current) {
    try {
      bgBrightness = getImageBrightness(bgImageRef.current);
    } catch {
      bgBrightness = 255;
    }
  }

  // 🧠 AUTO CONTRAST

  function getBrightness(hex: string) {
    if (!hex || hex[0] !== "#") return 255;

    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);

    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  let finalColor = element.color ?? "#ffffff";
  const textBrightness = getBrightness(finalColor);
  const diff = Math.abs(bgBrightness - textBrightness);

  // box-г автоматаар битгий асаа
  let needsBox = false;

  // shadow бол зөвхөн уншигдах байдалд туслах жижиг effect
  if (diff < 90) {
    shadowStrength = 0.45;
  } else {
    shadowStrength = 0.25;
  }
  const shadowY = Math.min(fontSize * 0.05, 10);
  const blur = Math.min(fontSize * 0.12, 22);

  const dynamicShadow =
    shadowStrength > 0
      ? `0px ${shadowY}px ${blur}px rgba(0,0,0,${shadowStrength})`
      : "none";

  return (
    <div
      ref={boxRef}
      data-element-id={element.id}
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
        height: logicalH * scale,
        opacity: element.opacity,
        transform: `rotate(${element.rotation}deg)`,
        zIndex: selected
          ? 50
          : element.name === "AI BG"
            ? 0
            : element.type === "logo"
              ? 30
              : element.type === "text"
                ? 20
                : 10,
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
              lastAutoSizeRef.current = null;
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
              color: finalColor,
              fontSize: `${(element.fontSize ?? 40) * (element.fontScale ?? 1) * scale}px`,
              fontWeight: element.fontWeight ?? 400,
              fontFamily:
                element.fontFamily ?? "var(--font-inter), Inter, sans-serif",
              textAlign: element.textAlign ?? "left",
              lineHeight: element.lineHeight ?? 1.2,
              textShadow: dynamicShadow,

              background: "transparent",
              padding: 0,
              borderRadius: 0,

              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              overflow: "hidden",
              width: "100%",
              display: "block",
              boxSizing: "border-box",
              pointerEvents: selected ? "auto" : "none",
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
          ref={element.name === "AI BG" ? bgImageRef : null}
          src={element.src}
          alt={element.name}
          crossOrigin="anonymous"
          className={`h-full w-full ${
            element.name === "AI BG"
              ? "object-cover scale-[1.03]"
              : "object-contain"
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

export default memo(CanvasItem);
