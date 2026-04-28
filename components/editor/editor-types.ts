export type ElementType = "text" | "logo" | "line";

export type TextRole = "primary" | "secondary" | "support" | "contact";

export type EditorElement = {
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

  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
};
