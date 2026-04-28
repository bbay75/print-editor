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

  const texts = Array.isArray(data.texts) ? data.texts : [];

  texts.forEach((t: any) => {
    const rawText = String(t.text || "").trim();
    if (!rawText) return;

    const mappedRole = rawText.length > 20 ? "secondary" : "primary";

    const boxWidth = safeWidth;
    const boxHeight = previewCanvasHeight * 0.1;

    nextElements.push({
      id: Math.random().toString(36),
      type: "text",
      text: rawText,
      role: mappedRole,
      x: safeLeft,
      y: safeTop,
      width: boxWidth,
      height: boxHeight,
    });
  });

  return nextElements;
}
