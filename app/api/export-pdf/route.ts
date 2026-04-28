import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

function pickRegisteredFontName(fontFamily?: string, fontWeight?: number) {
  const family = (fontFamily || "").toLowerCase();
  const isBold = (fontWeight ?? 400) >= 700;

  if (family.includes("inter")) {
    return isBold ? "inter-bold" : "inter-regular";
  }

  if (family.includes("oswald")) {
    return isBold ? "oswald-bold" : "oswald-regular";
  }

  if (family.includes("caveat")) {
    return isBold ? "caveat-bold" : "caveat-regular";
  }

  if (family.includes("marck")) {
    return "marck-regular";
  }

  return isBold ? "bold" : "regular";
}

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

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

  pdfLeftPx?: number;
  pdfTopPx?: number;
  pdfWidthPx?: number;
  pdfHeightPx?: number;

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

type ExportPayload = {
  doc: {
    widthMm: number;
    heightMm: number;
    bleedMm: number;
    safeMm: number;
  };
  surfaceWidthPx: number;
  surfaceHeightPx: number;
  elements: EditorElement[];
  includeCropMarks?: boolean;
  preferCmyk?: boolean;
};

function pxToMm(px: number) {
  return px * 0.264583;
}

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
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

function drawCropMarks(
  doc: PDFKit.PDFDocument,
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

  doc.save();
  doc.lineWidth(0.2);
  doc.strokeColor("#000000");

  doc
    .moveTo(left - offset - markLength, top - offset)
    .lineTo(left - offset, top - offset)
    .stroke();
  doc
    .moveTo(left - offset, top - offset - markLength)
    .lineTo(left - offset, top - offset)
    .stroke();

  doc
    .moveTo(right + offset, top - offset)
    .lineTo(right + offset + markLength, top - offset)
    .stroke();
  doc
    .moveTo(right + offset, top - offset - markLength)
    .lineTo(right + offset, top - offset)
    .stroke();

  doc
    .moveTo(left - offset - markLength, bottom + offset)
    .lineTo(left - offset, bottom + offset)
    .stroke();
  doc
    .moveTo(left - offset, bottom + offset)
    .lineTo(left - offset, bottom + offset + markLength)
    .stroke();

  doc
    .moveTo(right + offset, bottom + offset)
    .lineTo(right + offset + markLength, bottom + offset)
    .stroke();
  doc
    .moveTo(right + offset, bottom + offset)
    .lineTo(right + offset, bottom + offset + markLength)
    .stroke();

  doc.restore();
}

function pickFontFile(fontFamily?: string, fontWeight?: number) {
  const family = (fontFamily || "").toLowerCase();
  const isBold = (fontWeight ?? 400) >= 700;

  if (family.includes("inter")) {
    return isBold
      ? path.join(process.cwd(), "public/fonts/Inter-Bold.ttf")
      : path.join(process.cwd(), "public/fonts/Inter-Regular.ttf");
  }

  if (family.includes("oswald")) {
    return isBold
      ? path.join(process.cwd(), "public/fonts/Oswald-Bold.ttf")
      : path.join(process.cwd(), "public/fonts/Oswald-Regular.ttf");
  }

  if (family.includes("caveat")) {
    return isBold
      ? path.join(process.cwd(), "public/fonts/Caveat-Bold.ttf")
      : path.join(process.cwd(), "public/fonts/Caveat-Regular.ttf");
  }

  if (family.includes("marck")) {
    return path.join(process.cwd(), "public/fonts/MarckScript-Regular.ttf");
  }

  return isBold
    ? path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf")
    : path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");
}

async function dataUrlToBuffer(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL");
  }

  const b64 = dataUrl.slice(commaIndex + 1);

  return {
    buffer: Buffer.from(b64, "base64"),
  };
}

function normalizePath(p: string) {
  return p.replace(/\\/g, "/");
}

async function ensureFileExists(filePath: string, label: string) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

async function createPdfxDefPs(params: {
  title: string;
  cmykProfilePath: string;
  trimLeftPt: number;
  trimRightPt: number;
  trimTopPt: number;
  trimBottomPt: number;
  bleedLeftPt: number;
  bleedRightPt: number;
  bleedTopPt: number;
  bleedBottomPt: number;
}) {
  const {
    title,
    cmykProfilePath,
    trimLeftPt,
    trimRightPt,
    trimTopPt,
    trimBottomPt,
    bleedLeftPt,
    bleedRightPt,
    bleedTopPt,
    bleedBottomPt,
  } = params;

  return `%!
% Custom PDF/X-1a definition file

[ /Title (${title})
  /DOCINFO pdfmark

[ /_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[{icc_PDFA}
<<
  /N 4
>>
/PUT pdfmark
[{icc_PDFA} (${normalizePath(cmykProfilePath)}) (r) file /PUT pdfmark

[ /_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
[{OutputIntent_PDFA}
<<
  /Type /OutputIntent
  /S /GTS_PDFX
  /OutputCondition (ISO Coated v2 300% ECI)
  /OutputConditionIdentifier (ISO Coated v2 300% ECI)
  /RegistryName (http://www.color.org)
  /Info (ISO Coated v2 300% ECI)
  /DestOutputProfile {icc_PDFA}
>>
/PUT pdfmark

[ /_objdef {Catalog} /type /dict /OBJ pdfmark
[{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark

<< /PDFXTrimBoxToMediaBoxOffset [${trimLeftPt} ${trimRightPt} ${trimTopPt} ${trimBottomPt}] >> setdistillerparams
<< /PDFXSetBleedBoxToMediaBox false >> setdistillerparams
<< /PDFXBleedBoxToTrimBoxOffset [${bleedLeftPt} ${bleedRightPt} ${bleedTopPt} ${bleedBottomPt}] >> setdistillerparams
`;
}

async function convertPdfToPdfX1a(
  inputBuffer: Buffer,
  docMeta: ExportPayload["doc"],
): Promise<Buffer> {
  const gsPath = process.env.GHOSTSCRIPT_PATH;
  if (!gsPath) {
    throw new Error("Ghostscript path not configured");
  }

  const tempDir = os.tmpdir();
  const id = randomUUID();

  const inputPath = path.join(tempDir, `input-${id}.pdf`);
  const outputPath = path.join(tempDir, `output-${id}.pdf`);
  const pdfxDefPath = path.join(tempDir, `pdfx-def-${id}.ps`);

  const cmykProfilePath = path.join(
    process.cwd(),
    "icc",
    "ISOcoated_v2_300_eci.icc",
  );

  await ensureFileExists(gsPath, "Ghostscript executable");
  await ensureFileExists(cmykProfilePath, "CMYK ICC profile");

  await fs.writeFile(inputPath, inputBuffer);

  const bleedPt = mmToPt(docMeta.bleedMm);

  const pdfxDef = await createPdfxDefPs({
    title: "design-x1a.pdf",
    cmykProfilePath,
    trimLeftPt: bleedPt,
    trimRightPt: bleedPt,
    trimTopPt: bleedPt,
    trimBottomPt: bleedPt,
    bleedLeftPt: bleedPt,
    bleedRightPt: bleedPt,
    bleedTopPt: bleedPt,
    bleedBottomPt: bleedPt,
  });

  await fs.writeFile(pdfxDefPath, pdfxDef, "utf8");

  const normalizedInput = normalizePath(inputPath);
  const normalizedOutput = normalizePath(outputPath);
  const normalizedPdfxDef = normalizePath(pdfxDefPath);

  const args = [
    "-dBATCH",
    "-dNOPAUSE",
    "-dNOSAFER",
    "-dPDFX=1",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.3",
    "-sColorConversionStrategy=CMYK",
    "-sProcessColorModel=DeviceCMYK",
    "-dPDFSETTINGS=/prepress",
    "-dEmbedAllFonts=true",
    "-dSubsetFonts=true",
    "-dCompressFonts=true",
    "-dDetectDuplicateImages=true",
    "-dAutoRotatePages=/None",
    `-sOutputFile=${normalizedOutput}`,
    normalizedPdfxDef,
    normalizedInput,
  ];

  try {
    await execFileAsync(gsPath, args);
    return await fs.readFile(outputPath);
  } catch (err: any) {
    throw new Error(
      `Ghostscript failed: ${err?.stderr || err?.message || "Unknown GS error"}`,
    );
  } finally {
    await Promise.allSettled([
      fs.unlink(inputPath),
      fs.unlink(outputPath),
      fs.unlink(pdfxDefPath),
    ]);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExportPayload;
    const {
      doc: docMeta,
      elements,
      includeCropMarks,
      surfaceWidthPx,
      surfaceHeightPx,
    } = body;

    if (!docMeta || !Array.isArray(elements)) {
      return NextResponse.json(
        { error: "Invalid export payload" },
        { status: 400 },
      );
    }

    const pageWidth = mmToPt(docMeta.widthMm + docMeta.bleedMm * 2);
    const pageHeight = mmToPt(docMeta.heightMm + docMeta.bleedMm * 2);

    const pdf = new PDFDocument({
      size: [pageWidth, pageHeight],
      margin: 0,
      compress: true,
      autoFirstPage: true,
      bufferPages: false,
      pdfVersion: "1.4",
      info: {
        Title: "design.pdf",
        Author: "NEGUN DESIGN",
      },
    });

    // 🔥 FONT REGISTER (энд)
    pdf.registerFont(
      "regular",
      path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
    );

    pdf.registerFont(
      "bold",
      path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
    );

    pdf.registerFont(
      "inter-regular",
      path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"),
    );

    pdf.registerFont(
      "inter-bold",
      path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"),
    );

    pdf.registerFont(
      "oswald-regular",
      path.join(process.cwd(), "public/fonts/Oswald-Regular.ttf"),
    );

    pdf.registerFont(
      "oswald-bold",
      path.join(process.cwd(), "public/fonts/Oswald-Bold.ttf"),
    );

    pdf.registerFont(
      "caveat-regular",
      path.join(process.cwd(), "public/fonts/Caveat-Regular.ttf"),
    );

    pdf.registerFont(
      "caveat-bold",
      path.join(process.cwd(), "public/fonts/Caveat-Bold.ttf"),
    );

    pdf.registerFont(
      "marck-regular",
      path.join(process.cwd(), "public/fonts/MarckScript-Regular.ttf"),
    );

    pdf.font("regular");

    const chunks: Buffer[] = [];
    pdf.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );

    const done = new Promise<Buffer>((resolve, reject) => {
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });
    const fontCache = new Map<string, Buffer>();

    async function getFontBuffer(fontPath: string) {
      const cached = fontCache.get(fontPath);
      if (cached) return cached;

      const buf = await fs.readFile(fontPath);
      fontCache.set(fontPath, buf);
      return buf;
    }
    for (const el of elements) {
      const bleedPt = mmToPt(docMeta.bleedMm);

      const x =
        bleedPt +
        ((el.pdfLeftPx ?? 0) / Math.max(surfaceWidthPx, 1)) *
          mmToPt(docMeta.widthMm);

      const y =
        bleedPt +
        ((el.pdfTopPx ?? 0) / Math.max(surfaceHeightPx, 1)) *
          mmToPt(docMeta.heightMm);

      const width =
        ((el.pdfWidthPx ?? 0) / Math.max(surfaceWidthPx, 1)) *
        mmToPt(docMeta.widthMm);

      const height =
        ((el.pdfHeightPx ?? 0) / Math.max(surfaceHeightPx, 1)) *
        mmToPt(docMeta.heightMm);
      if (el.type === "text" && el.text) {
        pdf.save();
        pdf.opacity(el.opacity ?? 1);

        const fontSizePt = fontPxToPt(
          (el.fontSize ?? 40) * (el.fontScale ?? 1),
        );

        const fontName = pickRegisteredFontName(el.fontFamily, el.fontWeight);
        const align = getPdfTextAlign(el.textAlign);

        pdf.font(fontName);
        pdf.fillColor(el.color ?? "#000000");
        pdf.fontSize(fontSizePt);

        // PDFKit дээр script font-ууд browser-оос арай доош суудаг
        let textYOffset = fontSizePt * 0.12;

        if (fontName.includes("caveat") || fontName.includes("marck")) {
          textYOffset = fontSizePt * 0.09;
        }

        const textY = y - textYOffset;

        pdf.text(el.text, x, textY, {
          width,
          align,
          lineGap: ((el.lineHeight ?? 1.2) - 1) * fontSizePt,
        });

        pdf.restore();
      }
      if (el.type === "line") {
        pdf.save();
        pdf.opacity(el.opacity ?? 1);

        const thickness =
          el.lineThickness && el.lineThickness > 0
            ? mmToPt(pxToMm(el.lineThickness))
            : Math.max(0.5, height);

        const lineY = y + thickness * 0.5 + 0.2;

        pdf
          .lineWidth(thickness)
          .strokeColor(el.color ?? "#ffffff")
          .moveTo(x, lineY)
          .lineTo(x + width, lineY)
          .stroke();

        pdf.restore();
      }
      if (el.type === "logo" && el.src) {
        try {
          const { buffer } = await dataUrlToBuffer(el.src);

          pdf.save();
          pdf.opacity(el.opacity ?? 1);

          if (el.name === "AI BG") {
            // 🔥 OBJECT-COVER яг дуурайлгана
            pdf.save();
            pdf.opacity(el.opacity ?? 1);

            if (el.name === "AI BG") {
              pdf.rect(x, y, width, height).clip();

              pdf.image(buffer, x, y, {
                cover: [width, height],
                align: "center",
                valign: "center",
              });
            } else {
              pdf.image(buffer, x, y, {
                fit: [width, height],
                align: "center",
                valign: "center",
              });
            }

            pdf.restore();
          } else {
            // LOGO
            pdf.image(buffer, x, y, {
              fit: [width, height],
              align: "center",
              valign: "center",
            });
          }

          pdf.restore();
        } catch (e) {
          console.warn("Logo draw skipped:", e);
        }
      }
    }

    if (includeCropMarks) {
      drawCropMarks(pdf, pageWidth, pageHeight, mmToPt(docMeta.bleedMm));
    }

    pdf.end();

    const rgbPdfBuffer = await done;

    let finalPdfBuffer = rgbPdfBuffer;
    let fileName = "design-rgb-fallback.pdf";
    let exportMode = "rgb-fallback";

    if (body.preferCmyk) {
      try {
        finalPdfBuffer = await convertPdfToPdfX1a(rgbPdfBuffer, docMeta);
        fileName = "design-pdfx1a.pdf";
        exportMode = "pdfx1a-cmyk";
      } catch (error) {
        console.warn("CMYK conversion skipped, using PDFKit fallback:", error);
      }
    }

    return new Response(new Uint8Array(finalPdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Export-Mode": exportMode,
      },
    });
  } catch (error) {
    console.error("EXPORT PDF ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "PDF export failed",
      },
      { status: 500 },
    );
  }
}
