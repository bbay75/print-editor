// lib/editor-types.ts

export type ElementType = "text" | "logo" | "line";

export type EditorElement = {
  id: string;
  type: ElementType;
  name: string;

  // POSITION (px)
  x: number;
  y: number;
  width: number;
  height: number;

  // POSITION (mm) - PRINT SOURCE OF TRUTH
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;

  rotation: number;
  opacity: number;

  // COMMON
  zIndex?: number;
  locked?: boolean;
  hidden?: boolean;

  // TEXT
  text?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;

  // LOGO
  src?: string;
  aspectRatio?: number;

  // LINE
  lineThickness?: number;

  // STYLE
  borderRadius?: number;
};

export type DocumentSettings = {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeMm: number;
};

export type PresetType = "business-card" | "post" | "poster" | "banner";

export type PresetDefinition = {
  id: PresetType;
  name: string;

  widthMm: number;
  heightMm: number;

  bleedMm: number;
  safeMm: number;

  description?: string;
};
