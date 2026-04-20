import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

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
  elements: EditorElement[];
  includeCropMarks?: boolean;
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

function drawCropMarks(doc: any, width: number, height: number, bleed: number) {
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

  const meta = dataUrl.slice(0, commaIndex);
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

  // Ghostscript PDF/X definition file
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
  const gsPath =
    process.env.GHOSTSCRIPT_PATH ||
    "C:/Program Files/gs/gs10.07.0/bin/gswin64c.exe";

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

  // MediaBox = trim size + bleed*2
  // TrimBox is inset from MediaBox by bleed on all sides
  const trimLeftPt = bleedPt;
  const trimRightPt = bleedPt;
  const trimTopPt = bleedPt;
  const trimBottomPt = bleedPt;

  // BleedBox = MediaBox in this setup
  const bleedLeftPt = bleedPt;
  const bleedRightPt = bleedPt;
  const bleedTopPt = bleedPt;
  const bleedBottomPt = bleedPt;

  const pdfxDef = await createPdfxDefPs({
    title: "design-x1a.pdf",
    cmykProfilePath,
    trimLeftPt,
    trimRightPt,
    trimTopPt,
    trimBottomPt,
    bleedLeftPt,
    bleedRightPt,
    bleedTopPt,
    bleedBottomPt,
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

  console.log("👉 GS PATH:", gsPath);
  console.log("👉 GS ARGS:", args);

  try {
    const result = await execFileAsync(gsPath, args);

    if (result.stdout) console.log("✅ GS stdout:", result.stdout);
    if (result.stderr) console.log("⚠️ GS stderr:", result.stderr);

    return await fs.readFile(outputPath);
  } catch (err: any) {
    console.error("❌ GS failed");
    console.error("code:", err?.code);
    console.error("stdout:", err?.stdout);
    console.error("stderr:", err?.stderr);
    console.error("message:", err?.message);

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
    const { doc: docMeta, elements, includeCropMarks } = body;

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

    const chunks: Buffer[] = [];

    pdf.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );

    const done = new Promise<Buffer>((resolve, reject) => {
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });

    for (const el of elements) {
      const x = mmToPt(
        docMeta.bleedMm + (el.xMm !== undefined ? el.xMm : pxToMm(el.x)),
      );
      const y = mmToPt(
        docMeta.bleedMm + (el.yMm !== undefined ? el.yMm : pxToMm(el.y)),
      );
      const width = mmToPt(
        el.widthMm !== undefined ? el.widthMm : pxToMm(el.width),
      );
      const height = mmToPt(
        el.heightMm !== undefined ? el.heightMm : pxToMm(el.height),
      );

      if (el.type === "text" && el.text) {
        const fontFile = pickFontFile(el.fontFamily, el.fontWeight);
        const fontBuffer = await fs.readFile(fontFile);
        const fontSizePt = fontPxToPt(
          (el.fontSize ?? 40) * (el.fontScale ?? 1),
        );
        const align = getPdfTextAlign(el.textAlign);

        pdf.save();
        pdf.fillColor(el.color ?? "#000000");
        pdf.font(fontBuffer);
        pdf.fontSize(fontSizePt);
        pdf.opacity(1);

        pdf.text(el.text, x, y, {
          width,
          align,
          lineGap: Math.max(0, ((el.lineHeight ?? 1.2) - 1) * fontSizePt),
        });

        pdf.restore();
      }

      if (el.type === "line") {
        const thickness = Math.max(
          0.2,
          mmToPt(el.heightMm ?? pxToMm(el.lineThickness ?? el.height ?? 6)),
        );

        pdf.save();
        pdf.strokeColor(el.color ?? "#000000");
        pdf.opacity(el.opacity ?? 1);
        pdf.lineWidth(thickness);

        pdf
          .moveTo(x, y + height / 2)
          .lineTo(x + width, y + height / 2)
          .stroke();

        pdf.restore();
      }

      if (el.type === "logo" && el.src) {
        try {
          const { buffer } = await dataUrlToBuffer(el.src);
          pdf.save();
          pdf.opacity(el.opacity ?? 1);
          pdf.image(buffer, x, y, { width, height });
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
    const pdfxBuffer = await convertPdfToPdfX1a(rgbPdfBuffer, docMeta);

    return new Response(new Uint8Array(pdfxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="design-pdfx1a.pdf"',
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
