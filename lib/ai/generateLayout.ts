export function buildAiElements({
  data,
  layoutType,
  previewCanvasWidth,
  previewCanvasHeight,
  previewSafe,
}: any) {
  const nextElements: any[] = [];

  const safeLeft = previewSafe;
  const safeTop = previewSafe;
  const safeRight = previewCanvasWidth - previewSafe;
  const safeBottom = previewCanvasHeight - previewSafe;
  const safeWidth = Math.max(260, safeRight - safeLeft);
  const safeHeight = Math.max(260, safeBottom - safeTop);

  const texts = Array.isArray(data.texts) ? data.texts : [];

  const cleanedTexts = texts
    .map((t: any) => ({
      ...t,
      text: String(t.text || "").trim(),
    }))
    .filter((t: any) => t.text);

  const total = cleanedTexts.length || 1;

  cleanedTexts.forEach((t: any, index: number) => {
    const rawText = t.text;

    const role =
      t.role === "headline"
        ? "primary"
        : t.role === "cta"
          ? "contact"
          : "secondary";

    const fontSize =
      role === "primary"
        ? Math.round(previewCanvasHeight * 0.09)
        : role === "contact"
          ? Math.round(previewCanvasHeight * 0.045)
          : Math.round(previewCanvasHeight * 0.055);

    const boxWidth =
      layoutType === "split"
        ? Math.round(safeWidth * 0.52)
        : Math.round(safeWidth * 0.9);

    const x =
      layoutType === "split" ? safeLeft : safeLeft + (safeWidth - boxWidth) / 2;

    let y = safeTop + safeHeight * 0.22 + index * (fontSize * 1.65);

    if (layoutType === "top-heavy") {
      y = safeTop + index * (fontSize * 1.55);
    }

    if (layoutType === "center") {
      const groupHeight = total * fontSize * 1.65;
      y =
        safeTop + safeHeight / 2 - groupHeight / 2 + index * (fontSize * 1.65);
    }

    if (layoutType === "hero") {
      y = safeTop + safeHeight * 0.18 + index * (fontSize * 1.55);
    }

    if (role === "contact") {
      y = Math.min(y, safeBottom - fontSize * 1.8);
    }

    nextElements.push({
      id: crypto.randomUUID(),
      type: "text",
      text: rawText,
      role,
      x,
      y,
      width: boxWidth,
      height: fontSize * 1.4,
      fontSize,
      fontScale: 1,
      fontWeight: role === "primary" ? 800 : 700,
      color: t.color || "#ffffff",
      textAlign: t.align || "center",
      lineHeight: role === "primary" ? 0.95 : 1.05,
      rotation: 0,
      opacity: 1,
      zIndex: 20 + index,
    });
  });

  return nextElements;
}
