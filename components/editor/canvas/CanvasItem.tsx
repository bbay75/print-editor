"use client";
import React, { useEffect, useRef, useState } from "react";
import type { EditorElement } from "../core/editor-types";
import { SNAP_DISTANCE, clamp, pxToMm } from "../core/editor-utils";
import MiniActionBar from "./MiniActionBar";
import TextItem from "./TextItem";
import ImageItem from "./ImageItem";
import LineItem from "./LineItem";
import { Trash2 } from "lucide-react";
import {
  estimateTextVisualHeight,
  getElementVisualHeight,
  getElementWidth,
  getElementX,
  getElementY,
  getStoredElementHeight,
} from "./canvasTextMetrics";

function getImageBrightness(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 255;

  const size = 40;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  const data = ctx.getImageData(0, 0, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
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

function getBrightness(hex: string) {
  if (!hex || hex[0] !== "#") return 255;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return (r * 299 + g * 587 + b * 114) / 1000;
}

function CanvasItem({
  element,
  elements,
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
  elements: EditorElement[];
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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const wasSelectedOnPointerDownRef = useRef(false);

  useEffect(() => {
    if (!selected) setIsTextEditing(false);
  }, [selected]);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const latestDragPatchRef = useRef<Partial<EditorElement> | null>(null);
  const lastGuideUpdateRef = useRef(0);
  const estimatedTextHeight =
    element.type === "text" ? estimateTextVisualHeight(element) : 0;
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
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );

  const pinchRef = useRef<{
    startDistance: number;
    startFontSize: number;
    changed: boolean;
  } | null>(null);

  const getPinchDistance = () => {
    const points = Array.from(touchPointsRef.current.values());
    if (points.length < 2) return 0;

    const dx = points[0].x - points[1].x;
    const dy = points[0].y - points[1].y;

    return Math.sqrt(dx * dx + dy * dy);
  };

  const logicalX = getElementX(element);
  const logicalY = getElementY(element);
  const logicalW = getElementWidth(element);
  const textHeightPadding =
    element.type === "text" ? 8 / Math.max(scale, 0.01) : 0;
  const storedH = getStoredElementHeight(element);
  const logicalH =
    element.type === "text"
      ? Math.max(storedH, estimatedTextHeight + textHeightPadding)
      : getElementVisualHeight(element);
  const isOutOfSafe =
    element.name !== "AI BG" &&
    (logicalX < previewSafe ||
      logicalY < previewSafe ||
      logicalX + logicalW > docWidth - previewSafe ||
      logicalY + logicalH > docHeight - previewSafe);
  let bgBrightness = 255;
  if (bgImageRef.current) {
    try {
      bgBrightness = getImageBrightness(bgImageRef.current);
    } catch {
      bgBrightness = 255;
    }
  }

  const fontSize = (element.fontSize ?? 40) * (element.fontScale ?? 1);
  const finalColor = element.color;
  const diff = finalColor
    ? Math.abs(bgBrightness - getBrightness(finalColor))
    : 255;

  let shadowStrength = (element as any).shadowStrength ?? 0.7;
  if (element.role === "primary") shadowStrength = 0.85;
  if (element.role === "contact") shadowStrength = 0.5;
  shadowStrength = diff < 90 ? 0.45 : 0.25;

  const shadowY = Math.min(fontSize * 0.05, 10);
  const blur = Math.min(fontSize * 0.12, 22);
  const dynamicShadow =
    shadowStrength > 0
      ? `0px ${shadowY}px ${blur}px rgba(0,0,0,${shadowStrength})`
      : "none";

  const getLiveVisualHeight = () => {
    if (element.type !== "text") return logicalH;

    const visibleTextNode = boxRef.current?.querySelector(
      '[data-editor-visible-text="true"]',
    ) as HTMLElement | null;

    const liveHeight = visibleTextNode?.getBoundingClientRect().height;
    if (typeof liveHeight === "number" && liveHeight > 0) {
      return liveHeight / scale;
    }

    return estimatedTextHeight + textHeightPadding;
  };

  const startDrag = (clientX: number, clientY: number) => {
    onSelect();
    onDragStart();

    latestDragPatchRef.current = null;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      baseX: getElementX(element),
      baseY: getElementY(element),
      changed: false,
    };
  };
  const applySnapping = (
    nextX: number,
    nextY: number,
    visualWidth: number,
    visualHeight: number,
  ) => {
    let snapped = false;
    const SNAP_DISTANCE_ROLE = SNAP_DISTANCE * 4;
    const SNAP_DISTANCE_SAFE = SNAP_DISTANCE * 4;
    const minX = 0;
    const minY = 0;

    const maxX =
      visualWidth > docWidth ? 0 : Math.max(0, docWidth - visualWidth);
    const maxY =
      visualHeight > docHeight ? 0 : Math.max(0, docHeight - visualHeight);

    let snappedX = clamp(nextX, minX, maxX);
    let snappedY = clamp(nextY, minY, maxY);

    let verticalGuide: number | null = null;
    let horizontalGuide: number | null = null;

    const safeLeft = previewSafe;
    const safeRight = docWidth - previewSafe;
    const safeTop = previewSafe;
    const safeBottom = docHeight - previewSafe;

    let left = snappedX;
    let right = snappedX + visualWidth;
    let top = snappedY;
    let bottom = snappedY + visualHeight;

    const refreshBounds = () => {
      left = snappedX;
      right = snappedX + visualWidth;
      top = snappedY;
      bottom = snappedY + visualHeight;
    };
    if (Math.abs(left - safeLeft) < SNAP_DISTANCE_SAFE) {
      snappedX = safeLeft;
      verticalGuide = safeLeft;
      refreshBounds();
      snapped = true; // 👈 нэм
    }
    if (Math.abs(right - safeRight) < SNAP_DISTANCE_SAFE) {
      snappedX = safeRight - visualWidth;
      verticalGuide = safeRight;
      refreshBounds();
      snapped = true; // 👈 нэм
    }
    if (Math.abs(top - safeTop) < SNAP_DISTANCE_SAFE) {
      snappedY = safeTop;
      horizontalGuide = safeTop;
      refreshBounds();
      snapped = true; // 👈 нэм
    }
    if (Math.abs(bottom - safeBottom) < SNAP_DISTANCE_SAFE) {
      snappedY = safeBottom - visualHeight;
      horizontalGuide = safeBottom;
      refreshBounds();
      snapped = true; // 👈 нэм
    }
    let centerX = snappedX + visualWidth / 2;
    const centerY = snappedY + visualHeight / 2;
    elements.forEach((other) => {
      if (other.id === element.id) return;
      if (other.name === "AI BG") return;

      const otherX = getElementX(other);
      const otherY = getElementY(other);
      const otherW = getElementWidth(other);

      const otherH = getElementVisualHeight(other);

      const otherCenterX = otherX + otherW / 2;
      const otherCenterY = otherY + otherH / 2;

      if (!snapped && Math.abs(centerX - otherCenterX) < SNAP_DISTANCE * 2) {
        snappedX = otherCenterX - visualWidth / 2;
        verticalGuide = otherCenterX;
        refreshBounds();
        snapped = true;
      }

      if (!snapped && Math.abs(centerY - otherCenterY) < SNAP_DISTANCE * 2) {
        snappedY = otherCenterY - visualHeight / 2;
        horizontalGuide = otherCenterY;
        refreshBounds();
        snapped = true;
      }
    });
    // BRAND LOGO SMART SNAP
    if (!snapped && element.type === "logo") {
      const logoSnap = SNAP_DISTANCE * 4;

      const targetLeft = previewSafe;
      const targetRight = docWidth - previewSafe - visualWidth;
      const targetTop = previewSafe;
      const targetBottom = docHeight - previewSafe - visualHeight;
      const targetCenter = docWidth / 2 - visualWidth / 2;

      if (Math.abs(snappedX - targetLeft) < logoSnap) {
        snappedX = targetLeft;
        verticalGuide = targetLeft;
        snapped = true;
      }

      if (Math.abs(snappedX - targetRight) < logoSnap) {
        snappedX = targetRight;
        verticalGuide = docWidth - previewSafe;
        snapped = true;
      }

      if (Math.abs(snappedX - targetCenter) < logoSnap) {
        snappedX = targetCenter;
        verticalGuide = docWidth / 2;
        snapped = true;
      }

      if (Math.abs(snappedY - targetTop) < logoSnap) {
        snappedY = targetTop;
        horizontalGuide = targetTop;
        snapped = true;
      }

      if (Math.abs(snappedY - targetBottom) < logoSnap) {
        snappedY = targetBottom;
        horizontalGuide = docHeight - previewSafe;
        snapped = true;
      }
    }
    // 👉 ROLE-BASED SMART SNAP (soft, lock биш)
    if (!snapped && element.role === "primary") {
      if (Math.abs(centerX - docWidth / 2) < SNAP_DISTANCE_ROLE) {
        snappedX = docWidth / 2 - visualWidth / 2;
        verticalGuide = docWidth / 2;
        centerX = snappedX + visualWidth / 2; // 👈 нэм
      }
    }
    if (!snapped && element.role === "contact") {
      const targetBottom = docHeight - previewSafe;

      if (Math.abs(bottom - targetBottom) < SNAP_DISTANCE_ROLE) {
        snappedY = targetBottom - visualHeight;
        horizontalGuide = targetBottom;
      }
    }
    refreshBounds();
    if (!snapped && Math.abs(left - 0) < SNAP_DISTANCE) {
      snappedX = 0;
      verticalGuide = 0;
    }
    if (!snapped && Math.abs(right - docWidth) < SNAP_DISTANCE) {
      snappedX = docWidth - visualWidth;
      verticalGuide = docWidth;
    }
    if (
      !snapped &&
      element.role !== "primary" &&
      element.role !== "contact" &&
      Math.abs(centerX - docWidth / 2) < SNAP_DISTANCE
    ) {
      snappedX = docWidth / 2 - visualWidth / 2;
      verticalGuide = docWidth / 2;
    }

    if (!snapped && Math.abs(top - 0) < SNAP_DISTANCE) {
      snappedY = 0;
      horizontalGuide = 0;
    }
    if (!snapped && Math.abs(bottom - docHeight) < SNAP_DISTANCE) {
      snappedY = docHeight - visualHeight;
      horizontalGuide = docHeight;
    }
    if (Math.abs(centerY - docHeight / 2) < SNAP_DISTANCE) {
      snappedY = docHeight / 2 - visualHeight / 2;
      horizontalGuide = docHeight / 2;
    }

    return {
      snappedX: clamp(snappedX, minX, maxX),
      snappedY: clamp(snappedY, minY, maxY),
      verticalGuide,
      horizontalGuide,
    };
  };

  const handleBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (element.name === "AI BG") return;

    e.stopPropagation();

    wasSelectedOnPointerDownRef.current = selected;

    if (!selected) {
      setIsTextEditing(false);
    }

    onSelect();

    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (target?.closest("textarea")) return;

    // ✅ Desktop дээр text дээр 1 дарахад зөвхөн select,
    // ✅ 2 дарахад edit mode орно.
    // ✅ Text зөөх бол дээрх жижиг move handle-оор зөөнө.
    if (element.type === "text" && e.pointerType === "mouse") {
      return;
    }

    // ✅ MOBILE PINCH START
    if (e.pointerType === "touch" && element.type === "text") {
      touchPointsRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });

      if (touchPointsRef.current.size === 2) {
        dragRef.current = null;

        pinchRef.current = {
          startDistance: Math.max(getPinchDistance(), 1),
          startFontSize: element.fontSize ?? 40,
          changed: false,
        };

        onDragStart();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
    }

    startDrag(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleMoveHandlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    startDrag(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // ✅ MOBILE PINCH MOVE
    if (e.pointerType === "touch" && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
    }

    if (pinchRef.current && element.type === "text") {
      const currentDistance = getPinchDistance();

      if (currentDistance > 0 && pinchRef.current.startDistance > 0) {
        const ratio = currentDistance / pinchRef.current.startDistance;
        const nextFontSize = clamp(
          Math.round(pinchRef.current.startFontSize * ratio),
          12,
          3000,
        );

        pinchRef.current.changed = true;

        onPatch({
          fontSize: nextFontSize,
          fontScale: 1,
        });
      }

      return;
    }

    if (!dragRef.current) return;

    const dx = (e.clientX - dragRef.current.startX) / scale;
    const dy = (e.clientY - dragRef.current.startY) / scale;
    const rawX = dragRef.current.baseX + dx;
    const rawY = dragRef.current.baseY + dy;
    const liveVisualHeight = getLiveVisualHeight();

    const { snappedX, snappedY, verticalGuide, horizontalGuide } =
      applySnapping(rawX, rawY, logicalW, liveVisualHeight);

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
      onGuidesChange({ vertical: verticalGuide, horizontal: horizontalGuide });
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e?.pointerType === "touch") {
      touchPointsRef.current.delete(e.pointerId);
    }

    if (pinchRef.current) {
      const changed = pinchRef.current.changed;

      pinchRef.current = null;
      touchPointsRef.current.clear();

      onGuidesChange({ vertical: null, horizontal: null });
      onDragEnd();

      if (changed) onCommit();

      return;
    }

    if (dragRef.current?.changed && latestDragPatchRef.current) {
      onPatch(latestDragPatchRef.current);
      onCommit();
    }

    latestDragPatchRef.current = null;
    dragRef.current = null;
    onGuidesChange({ vertical: null, horizontal: null });
    onDragEnd();
  };

  const handlePointerCancel = () => {
    latestDragPatchRef.current = null;
    dragRef.current = null;
    resizeRef.current = null;
    pinchRef.current = null;
    touchPointsRef.current.clear();
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
      baseW: logicalW,
      baseH: logicalH,
      changed: false,
    };

    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;

    const dx = (e.clientX - resizeRef.current.startX) / scale;
    const dy = (e.clientY - resizeRef.current.startY) / scale;
    if (element.type === "text") {
      const nextWidth = clamp(
        resizeRef.current.baseW + dx,
        80,
        Math.max(80, docWidth - logicalX),
      );

      resizeRef.current.changed = true;

      onPatch({
        width: nextWidth,
        widthMm: pxToMm(nextWidth),
      });

      return;
    }
    if (element.type === "logo") {
      const ratio = element.aspectRatio ?? 1;
      const nextWidth = clamp(
        resizeRef.current.baseW + dx,
        60,
        Math.max(60, docWidth - logicalX),
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

    if (element.type === "line") {
      const nextWidth = clamp(
        resizeRef.current.baseW + dx,
        60,
        Math.max(60, docWidth - logicalX),
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
    }
  };

  const handleResizeEnd = () => {
    const changed = resizeRef.current?.changed;
    const isText = element.type === "text";

    resizeRef.current = null;
    onGuidesChange({ vertical: null, horizontal: null });
    onDragEnd();

    if (!changed) return;

    if (isText) {
      requestAnimationFrame(() => {
        const visibleTextNode = boxRef.current?.querySelector(
          '[data-editor-visible-text="true"]',
        ) as HTMLElement | null;

        if (visibleTextNode && visibleTextNode.scrollHeight > 0) {
          const nextHeight =
            (visibleTextNode.scrollHeight + 2) / Math.max(scale, 0.01);
          onPatch({
            height: nextHeight,
            heightMm: pxToMm(nextHeight),
          });
        }

        onCommit();
      });

      return;
    }

    onCommit();
  };

  return (
    <div
      ref={boxRef}
      data-element-id={element.id}
      onPointerDown={handleBoxPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerUp}
      onClick={(e) => {
        if (element.type !== "text") return;
        e.stopPropagation();

        // 1-р click: зөвхөн box select
        if (!wasSelectedOnPointerDownRef.current) {
          setIsTextEditing(false);
          return;
        }

        // 2-р click: text бичих mode
        setIsTextEditing(true);

        requestAnimationFrame(() => {
          const textarea = boxRef.current?.querySelector("textarea");

          if (textarea instanceof HTMLTextAreaElement) {
            textarea.focus();
          }
        });
      }}
      className={`absolute touch-none ${
        selected
          ? isOutOfSafe
            ? "ring-2 ring-red-500 ring-offset-2"
            : "ring-2 ring-blue-500 ring-offset-2"
          : isOutOfSafe
            ? "ring-2 ring-red-400 ring-offset-1"
            : ""
      }`}
      style={{
        left: (logicalX + previewBleed) * scale,
        top: (logicalY + previewBleed) * scale,
        width: logicalW * scale,
        ...(element.type === "text"
          ? {
              height: "auto",
              minHeight: 0,
              maxHeight: "none",
            }
          : {
              height: logicalH * scale,
              minHeight: logicalH * scale,
              maxHeight: "none",
            }),
        overflow: "visible",
        transform: `rotate(${element.rotation}deg)`,
        zIndex:
          (element.name === "AI BG"
            ? 0
            : element.type === "logo"
              ? 40
              : element.type === "text"
                ? 20
                : 10) + (selected ? 1 : 0),
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
      {selected && (
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="
absolute
bottom-0 left-0
-translate-x-1/2 translate-y-1/2
z-30
h-7 w-7
flex items-center justify-center
rounded-full
bg-white
text-red-500
shadow-md
border border-red-200
hover:bg-red-50
"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {isOutOfSafe && selected && (
        <div className="pointer-events-none absolute -top-9 left-0 z-[999999] rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white shadow">
          ⚠ Аюулгүйн бүс давсан
        </div>
      )}
      {element.type === "text" && (
        <TextItem
          element={{ ...element, isEditing: isTextEditing } as EditorElement}
          scale={scale}
          color={finalColor as any}
          textShadow={dynamicShadow}
          onSelect={onSelect}
          onPatch={onPatch}
          onCommit={onCommit}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      )}

      {element.type === "logo" && (
        <ImageItem element={element} bgImageRef={bgImageRef} />
      )}

      {element.type === "line" && (
        <LineItem element={element} scale={scale} logicalH={storedH} />
      )}

      {selected && element.name !== "AI BG" && (
        <button
          type="button"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          aria-label="Resize"
          style={{
            position: "absolute",
            right: -8,
            bottom: -8,
            width: 16,
            height: 16,
            borderRadius: 9999,
            backgroundColor: "#3b82f6",
            border: "2px solid white",
            zIndex: 999999,
            cursor: "se-resize",
            pointerEvents: "auto",
          }}
        />
      )}
    </div>
  );
}

export default CanvasItem;
