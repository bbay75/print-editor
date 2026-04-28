import type { EditorElement } from "./editor-types";

export const cloneElements = (items: EditorElement[]) =>
  JSON.parse(JSON.stringify(items)) as EditorElement[];

export const sameElements = (a: EditorElement[], b: EditorElement[]) =>
  JSON.stringify(a) === JSON.stringify(b);
