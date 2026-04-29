"use client";

import { useState } from "react";
const FONT_OPTIONS = [
  {
    label: "Inter",
    value: "var(--font-inter), Inter, sans-serif",
    preview: "var(--font-inter), Inter, sans-serif",
  },
  {
    label: "Noto Sans",
    value: "var(--font-noto-sans), sans-serif",
    preview: "var(--font-noto-sans), sans-serif",
  },
  {
    label: "Oswald",
    value: "var(--font-oswald), sans-serif",
    preview: "var(--font-oswald), sans-serif",
  },
  {
    label: "Marck Script",
    value: "var(--font-marck-script), cursive",
    preview: "var(--font-marck-script), cursive",
  },
  {
    label: "Caveat",
    value: "var(--font-caveat), cursive",
    preview: "var(--font-caveat), cursive",
  },
];

function FontPreviewDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedFont =
    FONT_OPTIONS.find((font) => font.value === value) ?? FONT_OPTIONS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left outline-none"
      >
        <div>
          <div style={{ fontFamily: selectedFont.preview }}>Шинэ текст</div>
          <div className="text-xs text-slate-400">{selectedFont.label}</div>
        </div>
        <span className="ml-3 text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-[100] mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              type="button"
              onClick={() => {
                onChange(font.value);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            >
              <div style={{ fontFamily: font.preview }}>
                <div className="text-sm">{font.label}</div>
                <div className="text-lg opacity-80">Шинэ текст</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export default FontPreviewDropdown;
