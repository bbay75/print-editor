"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  aiTips: string[];
};

export default function AiTipsModal({ open, onClose, aiTips }: Props) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-slate-900">
            💡 AI зөвлөгөө
          </div>

          <button
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          {aiTips.length > 0 ? (
            aiTips.map((tip, index) => <div key={index}>• {tip}</div>)
          ) : (
            <div className="text-slate-500">Одоогоор зөвлөгөө алга.</div>
          )}
        </div>
      </div>
    </div>
  );
}
