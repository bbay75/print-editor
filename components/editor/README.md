# Editor folder structure

- `EditorShell.tsx` — main state/orchestration file.
- `canvas/` — canvas item rendering, drag/resize.
- `controls/` — toolbar/buttons/font UI.
- `modals/` — registration/access modals.
- `ai/` — AI JSON to element conversion and layout engines.
- `core/` — shared types, units, history, typography.
- `validation/` — before-AI and document size checks.

Root `editor-types.ts`, `editor-utils.ts`, `editor-elements.ts`, `editor-history.ts` are compatibility re-exports, so old imports will not break.
