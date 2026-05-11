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
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#334155"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function cleanVisibleText(text: string) {
  return text.replace(/\s{2,}/g, " ").trim();
}

function looksLikePhone(text: string) {
  return /(\+?\d[\d\s-]{5,})/.test(text);
}

type LayoutType = "hero" | "split" | "center";

function normalizeLayoutType(value: any): LayoutType {
  if (value === "hero" || value === "split" || value === "center") {
    return value;
  }

  return "hero";
}
function buildLayoutGuide(layoutType: LayoutType) {
  const common = `
You are creating ONLY the background image for an editable print poster.

CRITICAL:
Text will be added later by code.
The background must be composed around a protected typography zone.

GLOBAL RULES:
- No text, no letters, no logo, no watermark, no signs, no UI.
- Full bleed, edge to edge, print-ready.
- The main subject must be visually separated from the typography zone.
- The typography zone must be calm, readable, low-detail, and high-contrast.
- Do not place faces, bodies, products, cars, buildings, characters, food, hands, sharp edges, bright highlights, or high-detail patterns inside typography zones.
- The typography zone may contain only soft light, sky, wall, atmosphere, shadow, blur, gradient, smoke, clean surface, or smooth low-detail texture.
- Do not create fake white boxes, cards, rectangles, empty panels, or placeholder frames.
- The composition should feel designed, premium, intentional, and ready for editable text overlay.
`;

  if (layoutType === "hero") {
    return `
${common}

LAYOUT CONTRACT: HERO

TYPOGRAPHY ZONE:
- Left 42% of the image.
- From 28% height down to 82% height.
- This full left column is reserved for headline, support text, CTA, and contact.

SUBJECT ZONE:
- Main subject must be on the right 50% of the image.
- Subject may be large and cinematic, but must not enter the left typography column.
- If people or characters appear, their faces and bodies must stay right of center.

BACKGROUND FEEL:
- Cinematic commercial poster.
- Strong subject on right.
- Clean readable negative space on left.
- Natural shadow or gradient behind typography area.
`;
  }

  if (layoutType === "split") {
    return `
${common}

LAYOUT CONTRACT: SPLIT

TYPOGRAPHY ZONE:
- Left 44% of the image.
- x: 7% to 46% width.
- y: 18% to 82% height.
- This full left column is reserved for headline, details, CTA, and contact.

SUBJECT ZONE:
- Main subject must be on the right 50% of the image.
- Subject can be large and detailed on the right.
- It must not cross into the left typography column.
- If people, children, products, cars, buildings, or characters appear, place them on the right side.

BACKGROUND FEEL:
- Natural premium left/right advertising composition.
- Not a harsh split screen.
- Soft lighting transition between text area and subject area.
`;
  }

  return `
${common}

LAYOUT CONTRACT: CENTER

TYPOGRAPHY ZONE:
- Center readable block.
- x: 18% to 82% width.
- y: 24% to 62% height.
- This central area is reserved for headline and supporting text.

SUBJECT ZONE:
- Main subject must stay around edges, lower area, corners, or background depth.
- Do not place faces, bodies, products, characters, buildings, cars, or strong details in the central typography zone.
- Center must remain calm and readable.

BACKGROUND FEEL:
- Balanced central advertising composition.
- Soft depth around center.
- Main visuals support the center, not cover it.
`;
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
You are an AI design assistant for a print editor.

Return ONLY valid JSON.

STRICT RULES:
- Use the user's main language.
- If the user mixes languages naturally, keep that mix.
- Generate output in the SAME language as the user input.
- Keep text short and print-ready.
- Include 2-5 text elements.
- Understand the user's prompt as a design brief, NOT as final text.
- Do NOT copy weak phrases directly from the prompt.
- Do NOT generate robotic copy.
- Headline should feel natural and readable.
- Understand the user's prompt as a design brief, NOT as final text.

- Treat the user's request as a design intention, not as literal final text.
- Do not directly repeat generic requests like:
  "poster",
  "banner",
  "advertisement",
  "sign",
  "clinic sign",
  "fitness poster",
  unless they naturally belong in the actual design copy.
- Generate realistic advertising or informational copy naturally.

- Do NOT copy weak phrases directly from the prompt.

COPY STYLE:
- Use real advertising language.
- Avoid awkward translation.
- Keep branding words when natural.
- Headlines should be SHORT and visually strong.
- Prefer 2-5 words for headlines.
- Supporting text should contain details.
- Do not put the entire message inside the headline.
HEADLINE SIZE RULE:
- Headlines should feel balanced inside the composition.
- Avoid oversized headlines unless the design is intentionally dramatic.
- Short headlines should usually stay on a single line.
- Do not make headlines excessively tall or dominant.
- Maintain breathing room around typography.
COLOR RULE:
- Text readability is EXTREMELY important.
- Text must strongly contrast against the protected typography zone.

- Choose typography colors that naturally fit the mood and composition.
- Prefer clean professional readable colors.

- For dark backgrounds:
  prefer light typography.

- For light backgrounds:
  prefer dark typography.

- For colorful or saturated backgrounds:
  avoid low-contrast or overly similar colors.

- Avoid:
  - dark text on dark backgrounds
  - light text on light backgrounds
  - saturated text over saturated backgrounds
  - low-contrast color combinations

- Typography readability is more important than exact color matching.

- All colors must be valid HEX.

LAYOUT TYPES:
- hero
- split
- center

LAYOUT DECISION:
- Choose exactly ONE layoutType: hero, split, or center.
- Choose the layout that best fits the visual composition naturally.
- Do not choose layout by business category alone.

hero:
- Best for cinematic ads.
- Text group on left side.
- Main subject on right side or background depth.

split:
- Best for commercial ads with clear subject separation.
- Full text group on left.
- Main subject on right.
- Not a harsh 50/50 template.

center:
- Best for symmetrical, premium, minimal, announcement, or calm designs.
- Text group in center.
- Main subject must stay around edges, background depth, bottom, or corners.

Important:
- The ENTIRE text group must be protected, not only the headline.
- Never place people, faces, products, buildings, cars, characters, or focal objects behind the text group.
- Different prompts should naturally produce different layouts.

BACKGROUND RULE:
- Background must be printable and full bleed.
- No text.
- No readable words.
- No logos.
- No watermark.
- No UI.
INTENT UNDERSTANDING:
- Interpret the user's intent naturally.
- Some requests may be:
  - advertisement
  - signage
  - informational
  - luxury branding
  - event poster
  - product promotion
  - editorial design
  - minimal design
  - cinematic campaign
  - corporate communication

- Choose composition, layout, mood, typography flow, lighting, and visual hierarchy naturally based on the user's intent.
- Do not force the same advertising style for every request.
- Do not assume every request is a dramatic commercial poster.
- Some requests should feel clean, informational, minimal, or corporate.
VISUAL DIRECTION RULE:
- The user may describe the desired background subject, scene, style, mood, object, environment, or atmosphere.
- Respect the user's background idea as much as possible.
- Adapt the requested background to the selected layout composition.
- The user's requested background must not break the protected typography zone.
- If the requested subject would overlap the typography zone, move it naturally to the main subject zone defined by the selected layout.
- The final image should feel like one professional advertising composition, not a random background.
POSITIONS:
top-left
top-center
top-right
center-left
center
center-right
bottom-left
bottom-center
bottom-right

Schema:
{
  "layoutType": "hero",
  "texts": [
    {
      "role": "headline",
      "text": "",
      "color": "#FFFFFF",
      "position": "center",
      "fontSize": 40,
      "fontWeight": 700,
      "align": "center"
    }
  ],
  "backgroundPrompt": "",
  "tips": [
    "",
    "",
    ""
  ]
}
          `,
        },

        {
          role: "user",

          content: `
User input:
${safePrompt}

Instruction:
Use the same language style as the user.
`,
        },
      ],

      text: {
        format: {
          type: "json_object",
        },
      },
    });

    const parsed = JSON.parse(parseRes.output_text || "{}");

    const layoutType = normalizeLayoutType(parsed.layoutType);

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

              color: typeof item.color === "string" ? item.color : "#FFFFFF",

              fontSize: Number(item.fontSize) || 40,

              fontWeight: Number(item.fontWeight) || 700,

              align:
                item.align === "left" || item.align === "right"
                  ? item.align
                  : "center",

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
                  : "center",
            };
          })
          .slice(0, 5)
      : [];

    const tips = Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : [];

    const layoutGuide = buildLayoutGuide(layoutType);

    let image: string | null = null;

    try {
      const backgroundPrompt = `
${parsed.backgroundPrompt || safePrompt}

Create a premium full-bleed printable background.

Follow the user's topic, mood, business type, colors, and visual direction.

Act like a professional art director:
- composition
- framing
- lighting
- atmosphere
- focal hierarchy
- depth
- visual balance

Selected layout:
${layoutType}
The background composition MUST visually match this selected layout.
Do not create a background that fights against the selected layout.

Layout guide:
${layoutGuide}

CRITICAL TYPOGRAPHY PROTECTION RULE:
The editor will place editable text on top of this background.

The selected layout defines a PROTECTED TYPOGRAPHY ZONE.
That zone must be visually reserved inside the background composition.

Absolutely do NOT place the main visual subject inside the protected typography zone.
Do NOT place people, faces, bodies, cars, products, buildings, characters, food, or high-detail objects inside that zone.
Do NOT place the brightest highlight or strongest contrast inside that zone.

The protected typography zone must remain calm, low-detail, and readable.
The main subject must be clearly separated from the typography zone.
The ENTIRE typography group must remain readable together.
If the image contains people, faces, family, children, portraits, or characters:
- faces and bodies must stay completely outside the full typography flow area
- do not place editable text over eyes, mouth, face, body, hands, or skin
- reserve a calm empty area beside them or above them for all text

Do not protect only the headline area.
Also protect:
- supporting text
- CTA
- contact details
- secondary typography

The full typography flow area must stay visually clean and readable.
Typography areas should still feel natural and visually rich using:
- atmosphere
- light
- blur
- shadow
- gradient
- wall
- sky
- smooth texture
- low-detail surfaces

Do NOT create fake blank boxes.
Do NOT create placeholder rectangles.
Do NOT create ugly empty panels.

Background only.
No text.
No letters.
No readable words.
No logos.
No watermark.
No UI.
Full bleed.
Edge to edge.
Print-ready.
`.trim();

      const imageRes = await client.images.generate({
        model: "gpt-image-1-mini",

        prompt: backgroundPrompt,

        size: isLandscape ? "1536x1024" : "1024x1536",
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
      layoutType,
      texts,
      image,
      tips,
    });
  } catch (e) {
    console.error("AI route error:", e);

    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
