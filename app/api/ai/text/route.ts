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

type LayoutType = "center" | "top-heavy" | "hero" | "split" | "split-balanced";

function normalizeLayoutType(value: any): LayoutType {
  if (
    value === "center" ||
    value === "top-heavy" ||
    value === "hero" ||
    value === "split" ||
    value === "split-balanced"
  ) {
    return value;
  }

  return "center";
}

function buildLayoutGuide(layoutType: LayoutType) {
  const common = `
This is a typography-aware advertising background.

IMPORTANT:
Editable text will be placed later by the editor.
The background image itself must reserve a protected typography zone.

Do NOT put the main subject inside the protected typography zone.
Do NOT put people, faces, bodies, cars, products, buildings, characters, food, strong highlights, or high-detail objects inside the typography zone.

The protected typography zone must contain only:
soft gradient, atmosphere, wall, sky, blur, shadow, smoke, clean surface, smooth texture, low-detail background, or negative space.

No text, no letters, no logos, no signs, no watermark, no UI.
Do not make empty boxes or panels.
Make it look like a real premium advertising poster composition.
`;

  if (layoutType === "hero") {
    return `
${common}

Protected typography column:
- left 42% width of the composition
- from upper-middle down to bottom-left

This entire typography column must remain readable for:
- headline
- supporting text
- CTA/contact text

Do NOT place:
- people
- body parts
- faces
- products
- strong highlights
- sharp edges
inside this typography column.

Main subject zone:
RIGHT side or center-right.

Composition:
Create a cinematic advertising composition.
Keep the strongest subject clearly separated from the typography column.
Use subtle cinematic shadow or atmospheric depth behind typography areas.
Keep readability natural and premium.
Do not create obvious blur cards or fake UI panels.
`;
  }

  if (layoutType === "split") {
    return `
${common}
Protected typography zone:
Primarily left-side readable space for headline and supporting text.

The typography area should feel naturally readable,
not artificially empty.

Allow atmospheric overlap, depth, soft gradients, light falloff,
or partial environmental continuation.

Do NOT place the main focal subject directly behind typography.

The visual subject may naturally extend slightly toward the typography side,
as long as readability remains strong.

Avoid hard left/right separation.
Create a premium natural advertising composition.

This area is reserved for:
- headline
- supporting text
- details
- CTA

Keep this entire column readable and low-detail.
Use subtle atmospheric gradient or soft lighting transition behind typography areas.
The readability support should feel natural and cinematic, not like a fake overlay panel.
Avoid harsh blur boxes or obvious rectangles.
`;
  }

  if (layoutType === "center") {
    return `
${common}
Protected typography zone:
CENTER area.

Main subject zone:
Edges, corners, bottom area, or soft background depth.

Composition:
Keep the center calm and readable.
Do not place main subject, face, product, or high-detail objects in the center.
`;
  }

  if (layoutType === "top-heavy") {
    return `
${common}
Protected typography area:
- upper-left to center-left flow area
- approximately 40-45% of the composition width
- from top area down toward middle

This FULL typography flow area must remain readable for:
- headline
- supporting text
- CTA
- details

Do NOT place:
- buildings
- windows
- faces
- people
- products
- strong edges
- high-detail architecture
directly behind this typography flow area.

Allow only:
- atmosphere
- soft gradients
- blur
- depth
- soft shadows
- low-detail surfaces
behind the typography flow area.

The visual subject should stay mostly outside this typography flow area.

Keep the full top band readable for:
- headline
- supporting text
- CTA

Avoid placing large objects or high-detail elements in this top band.
`;
  }

  return `
${common}
Protected typography zone:
TOP-CENTER for headline, plus LEFT and RIGHT detail zones below.

Main subject zone:
Background depth, bottom area, or edges.

Composition:
Keep top headline area and side detail areas calm and readable.
Do not place focal objects directly behind those zones.
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
- center
- top-heavy
- split
- split-balanced

LAYOUT DECISION:
- Choose exactly ONE layoutType.
- Do not choose randomly.
- Choose the layout that best fits the visual composition naturally.
- Do not choose layout by business category alone.

Choose layout based on:
- composition balance
- visual hierarchy
- subject placement
- readability
- cinematic feel
- negative space
- typography flow
- amount of text

Important:
- Different prompts should naturally produce different layouts.
- Avoid repeatedly choosing the same layout.
- Do not default to top-heavy.
- Do not default to split.
- Use top-heavy only when the visual subject naturally leaves readable upper-side space.
- Use split only when the composition naturally supports left/right separation.
- If the scene has strong centered symmetry, centered depth, vanishing-point composition, or cinematic central focus, prefer center layout.

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
