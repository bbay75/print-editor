"use client";

export default function OrderModal({
  name,
  phone,
  isSendingOrder,
  onNameChange,
  onPhoneChange,
  onSubmit,
  onClose,
}: {
  name: string;
  phone: string;
  isSendingOrder: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold">Захиалга илгээх</h2>
        <input
          placeholder="Нэр"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-200 p-3"
        />
        <input
          placeholder="Утас"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="mt-3 w-full rounded-xl border border-slate-200 p-3"
        />
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSendingOrder}
            className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {isSendingOrder ? "Илгээж байна..." : "Илгээх"}
          </button>
          <button
            onClick={onClose}
            type="button"
            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium"
          >
            Болих
          </button>
        </div>
      </div>
    </div>
  );
}
