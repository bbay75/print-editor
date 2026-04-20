# Print Editor Tailwind Starter

A clean Next.js + Tailwind starter for a mobile-friendly print editor.

## Included
- Tailwind UI layout
- Direct text editing on canvas
- Drag and resize elements
- Layers panel
- Right settings panel
- Template library
- Smart snapping to canvas center
- AI text generation demo route
- AI layout suggestion demo route
- PNG / JPG / PDF export
- Mobile-friendly layout

## Run
```bash
npm install
npm run dev
```

Open:
```bash
http://localhost:3000/editor
```

## Important
This is a fresh starter source, not an automatic merge into your existing project.
You should copy the parts you want into your current app or use this as a clean new editor base.

## Main files
- `app/editor/page.tsx`
- `components/editor/EditorShell.tsx`
- `lib/editor-utils.ts`
- `app/api/ai/text/route.ts`
- `app/api/ai/layout/route.ts`

## Next improvements
- connect real OpenAI API
- image upload from device
- save to Supabase / DB
- real print bleed / trim guides
- keyboard shortcuts
- autosave history snapshots
