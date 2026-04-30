import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
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

    // 🔥 AI TEXT + LAYOUT
    const parseRes = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
You are an AI design assistant for a print editor.

Return ONLY valid JSON.

STRICT RULES:
- Use Mongolian language
- Do NOT add extra explanation
- Keep text short (print ready)
- Use strong headline
- Include 2-5 text elements

ROLES:
headline = main title
line = supporting text
cta = action text

LAYOUT TYPES:
- hero: big headline, premium poster style, strong center composition
- center: simple balanced layout, all text centered
- top-heavy: text mostly on top, useful when bottom image/background is important
- split: text on left side, visual/empty space on right side

POSITIONS (must use only these):
top-left, top-center, top-right,
center-left, center, center-right,
bottom-left, bottom-center, bottom-right

Each text MUST include:
- role
- text
- position
- color (HEX)
- Also include 2 to 3 short practical design tips
- Tips must be in Mongolian
- Tips should focus on contrast, spacing, typography, or readability
- Do not repeat the same idea
Position rule:
- Do NOT invent positions.
- Only include position if the user clearly asked for a location such as top, bottom, left, right, center, top-right, bottom-left.
- If user did not mention a location, omit position.
Schema:
{
"layoutType": "hero | center | top-heavy | split",
  "texts": [
    {
      "role": "headline | line | cta",
      "text": "",
      "position": "center",
      "color": "#ffffff",
      "fontSize": 40,
      "fontWeight": 600,
      "align": "center"
    }
  ],
  "backgroundPrompt": "",
  "tips": [
    "short practical advice",
    "short practical advice",
    "short practical advice"
  ]
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
    const tips = Array.isArray(parsed.tips)
      ? parsed.tips
          .filter((tip: any) => typeof tip === "string" && tip.trim())
          .map((tip: string) => tip.trim())
          .slice(0, 3)
      : [];

    // 🔥 TEXT PARSE
    const texts = Array.isArray(parsed.texts)
      ? parsed.texts
          .filter((item: any) => item?.text)
          .map((item: any) => {
            const rawText = cleanVisibleText(String(item.text));

            return {
              role:
                item.role === "headline" || item.role === "cta"
                  ? item.role
                  : looksLikePhone(rawText)
                    ? "cta"
                    : "line",

              text: rawText,

              color: normalizeHexColor(item.color, "#ffffff"),

              fontSize: Number(item.fontSize) || 40,
              fontWeight: Number(item.fontWeight) || 600,

              align:
                item.align === "left" || item.align === "right"
                  ? item.align
                  : "center",

              // 🔥 POSITION ENGINE INPUT
              position:
                item.position === "top-left" ||
                item.position === "top-center" ||
                item.position === "top-right" ||
                item.position === "center-left" ||
                item.position === "center" ||
                item.position === "center-right" ||
                item.position === "bottom-left" ||
                item.position === "bottom-center" ||
                item.position === "bottom-right"
                  ? item.position
                  : undefined,
            };
          })
          .slice(0, 5)
      : [];

    // 🔥 BACKGROUND IMAGE
    let image: string | null = null;

    try {
      const backgroundPrompt = `
${parsed.backgroundPrompt || safePrompt},
background texture,
seamless,
edge to edge,
full bleed,
fills entire frame,
no margins,
no empty space,
no white background,
high detail,
realistic
`;

      const imageRes = await client.images.generate({
        model: "gpt-image-1-mini",
        prompt: backgroundPrompt,
        size: "1024x1024",
      });

      const imageBase64 = imageRes?.data?.[0]?.b64_json;

      if (imageBase64) {
        image = `data:image/png;base64,${imageBase64}`;
      }
    } catch (err) {
      console.error("Image fail:", err);
      image = svgFallbackBackground(isLandscape);
    }

    if (!image) {
      image = svgFallbackBackground(isLandscape);
    }

    return NextResponse.json({
      layoutType:
        parsed.layoutType === "center" ||
        parsed.layoutType === "top-heavy" ||
        parsed.layoutType === "hero" ||
        parsed.layoutType === "split"
          ? parsed.layoutType
          : "hero",
      texts,
      image,
      tips,
    });
  } catch (e) {
    console.error("AI route error:", e);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
