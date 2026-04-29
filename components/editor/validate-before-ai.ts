export function validateBeforeAI(doc: any) {
  const widthValue = String(doc.widthMm ?? "").trim();
  const heightValue = String(doc.heightMm ?? "").trim();

  const errors: { width?: string; height?: string } = {};

  if (!widthValue) errors.width = "Өргөний хэмжээг оруулна уу";
  if (!heightValue) errors.height = "Өндрийн хэмжээг оруулна уу";

  return {
    isValid: !errors.width && !errors.height,
    errors,
    widthValue,
    heightValue,
  };
}
