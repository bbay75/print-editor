import type { EditorElement } from "../core/editor-types";
import { mmToPx, pxToMm } from "../core/editor-utils";

function normalizeTextElement(element: EditorElement): EditorElement {
  if (element.type !== "text") return element;

  return {
    ...element,
    height: 0,
    heightMm: undefined,
  };
}

export function patchEditorElement(
  item: EditorElement,
  patch: Partial<EditorElement>,
): EditorElement {
  const safePatch = { ...patch };

  if (item.type === "text") {
    delete safePatch.height;
    delete safePatch.heightMm;
  }

  const next: EditorElement = { ...item, ...safePatch };

  if (safePatch.x !== undefined) next.xMm = pxToMm(safePatch.x);
  if (safePatch.y !== undefined) next.yMm = pxToMm(safePatch.y);
  if (safePatch.xMm !== undefined) next.x = mmToPx(safePatch.xMm);
  if (safePatch.yMm !== undefined) next.y = mmToPx(safePatch.yMm);

  if (safePatch.width !== undefined) next.widthMm = pxToMm(safePatch.width);
  if (safePatch.widthMm !== undefined) next.width = mmToPx(safePatch.widthMm);

  if (next.type !== "text") {
    if (safePatch.height !== undefined) next.heightMm = pxToMm(safePatch.height);
    if (safePatch.heightMm !== undefined) next.height = mmToPx(safePatch.heightMm);
  }

  if (next.type === "logo") {
    const aspectRatio = next.aspectRatio ?? 1;

    if (safePatch.width !== undefined && safePatch.height === undefined) {
      next.height = Math.round(next.width / aspectRatio);
      next.heightMm = pxToMm(next.height);
    }

    if (safePatch.height !== undefined && safePatch.width === undefined) {
      next.width = Math.round(next.height * aspectRatio);
      next.widthMm = pxToMm(next.width);
    }
  }

  if (next.type === "line") {
    if (safePatch.lineThickness !== undefined) {
      next.height = safePatch.lineThickness;
      next.heightMm = pxToMm(safePatch.lineThickness);
    }
  }

  return normalizeTextElement(next);
}
