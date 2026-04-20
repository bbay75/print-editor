import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractFallback(prompt: string) {
  const lines = prompt
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  let headline = "";
  let subtitle = "";
  let cta = "";

  for (const line of lines) {
    if (!headline && /гарчиг|headline|голд нь/i.test(line)) {
      const cleaned = line
        .replace(/.*?(гарчигтай|гарчиг|headline|голд нь)\s*/i, "")
        .replace(/^[:\-–—]\s*/, "")
        .replace(/гэж\s+бич\.?$/i, "")
        .trim();
      if (cleaned) headline = cleaned;
    }

    if (!subtitle && /доор нь|subtitle|coffee|dessert|brunch/i.test(line)) {
      const cleaned = line
        .replace(/.*?(доор нь|subtitle)\s*/i, "")
        .replace(/^[:\-–—]\s*/, "")
        .replace(/гэж\s+бич\.?$/i, "")
        .trim();
      if (cleaned) subtitle = cleaned;
    }

    if (!cta && /утас|phone|call/i.test(line)) {
      const cleaned = line
        .replace(/.*?(утас|phone|call)\s*[:：]?\s*/i, "")
        .trim();
      if (cleaned) cta = /^утас/i.test(line) ? `Утас: ${cleaned}` : cleaned;
    }
  }

  if (!headline) {
    const match = prompt.match(/([A-ZА-ЯӨҮЁ][A-ZА-ЯӨҮЁa-zа-яөүё\s]{3,40})/);
    if (match) headline = match[1].trim();
  }

  if (!subtitle) {
    const match = prompt.match(
      /(Coffee.*|Dessert.*|Brunch.*|Coffee\s*[•*·-]\s*Dessert.*)/i,
    );
    if (match) subtitle = match[1].replace(/\s+/g, " ").trim();
  }

  if (!cta) {
    const phone = prompt.match(/(\d{6,12})/);
    if (phone) cta = `Утас: ${phone[1]}`;
  }

  return { headline, subtitle, cta };
}

function svgFallbackBackground(isLandscape: boolean) {
  const width = isLandscape ? 1536 : 1024;
  const height = isLandscape ? 1024 : 1536;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#2b2118"/>
        <stop offset="100%" stop-color="#4a3728"/>
      </linearGradient>
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="table" tableValues="0 0 0.03 0.05"/>
        </feComponentTransfer>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.35"/>
  </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;

  const v = value.trim();
  if (!v) return fallback;

  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
  return isHex ? v : fallback;
}

function cleanVisibleText(text: string) {
  return text
    .replace(/\b(luxury|minimal|minimalist|modern|premium)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksLikePhone(text: string) {
  return /(\+?\d[\d\s-]{5,})/.test(text);
}

export async function POST(req: Request) {
  try {
    const { prompt, widthMm, heightMm } = await req.json();

    if (!prompt || !String(prompt).trim()) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const safePrompt = String(prompt).trim();
    const safeWidthMm = Number(widthMm) > 0 ? Number(widthMm) : 3500;
    const safeHeightMm = Number(heightMm) > 0 ? Number(heightMm) : 1500;
    const isLandscape = safeWidthMm >= safeHeightMm;

    const parseRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
You are an AI print layout parser.

STRICT RULES:
- Follow the user's request closely.
- Do not invent extra slogans.
- Do not add extra design text.
- Extract only editable content.
- Choose colors that fit the requested style and also contrast well with the background.
- Return JSON only.
- All colors must be valid HEX values like #FFFFFF or #f3d27a.
- Each text item must include a valid HEX color.

Schema:
{
  "texts": [
    {
      "role": "headline | line | cta",
      "text": "",
      "color": "#ffffff",
      "fontSize": 40,
      "fontWeight": 600,
      "align": "center"
    }
  ],
  "backgroundPrompt": ""
}
    `,
        },
        {
          role: "user",
          content: safePrompt,
        },
      ],
      text: {
        format: { type: "json_object" },
      },
    });

    const parsed = JSON.parse(parseRes.output_text || "{}");

    const texts = Array.isArray(parsed.texts)
      ? parsed.texts
          .filter(
            (item: any) =>
              item && typeof item.text === "string" && item.text.trim(),
          )
          .map((item: any) => {
            const rawText = cleanVisibleText(String(item.text).trim());

            return {
              role:
                item.role === "headline" || item.role === "cta"
                  ? item.role
                  : looksLikePhone(rawText)
                    ? "cta"
                    : "line",
              text: rawText,
              color: normalizeHexColor(item.color, "#ffffff"),
              fontSize: Number(item.fontSize) > 0 ? Number(item.fontSize) : 40,
              fontWeight:
                Number(item.fontWeight) > 0 ? Number(item.fontWeight) : 600,
              align:
                item.align === "left" || item.align === "right"
                  ? item.align
                  : "center",
            };
          })
          .filter((item: any) => item.text.length > 0)
          .slice(0, 5)
      : [];
    let image: string | null = null;

    try {
      const backgroundPrompt =
        typeof parsed.backgroundPrompt === "string" &&
        parsed.backgroundPrompt.trim()
          ? parsed.backgroundPrompt.trim()
          : "warm cafe background, abstract, textured, elegant, no text";
      const imagePrompt = `
Create a high-quality background image for a printed banner.

IMPORTANT:
- The image must follow the user's style request below
- Do not include any text
- Do not include letters, words, numbers, logos, signage, watermark, or typography
- Background image only

USER STYLE REQUEST:
${backgroundPrompt}

COMPOSITION:
- ultra wide horizontal banner
- panoramic 3:1 composition
- fill the full frame edge-to-edge with no empty white areas
- visually rich but keep the center area clean for text overlay
- avoid placing strong objects directly in the center
- professional print quality
`;

      console.log("🟡 IMAGE GENERATION START");

      const imageRes = await client.images.generate({
        model: "gpt-image-1-mini",
        prompt: imagePrompt,
        size: "1024x1024",
      });

      console.log("🟢 IMAGE RESPONSE RAW:", JSON.stringify(imageRes, null, 2));

      const imageBase64 =
        imageRes?.data &&
        Array.isArray(imageRes.data) &&
        imageRes.data[0]?.b64_json
          ? imageRes.data[0].b64_json
          : null;

      if (!imageBase64) {
        console.error("❌ NO IMAGE DATA RETURNED");
        throw new Error("No b64_json returned from image generation");
      }

      image = `data:image/png;base64,${imageBase64}`;

      console.log("✅ IMAGE GENERATED SUCCESS");
    } catch (err: any) {
      console.error("🔥 IMAGE GENERATION FAILED FULL:", err);
      console.error("🔥 MESSAGE:", err?.message);
      console.error("🔥 STATUS:", err?.status);
      console.error("🔥 RESPONSE:", err?.response?.data);

      image = svgFallbackBackground(isLandscape);
    }

    if (!image) {
      image = svgFallbackBackground(isLandscape);
    }
    return NextResponse.json({
      texts,
      image,
    });
  } catch (e) {
    console.error("AI route error:", e);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
