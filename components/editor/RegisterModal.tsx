type Props = {
  onClose: () => void;
};

export default function RegisterModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-slate-900">
          AI эрх дууссан байна
        </h2>

        <p className="mt-3 text-sm text-slate-600">
          Таны бүртгэлтэй хэрэглэгчийн AI эрх дууссан байна. Эрх нэмүүлэхийн
          тулд админтай холбогдоно уу.
        </p>

        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-800">
          📞 99012298
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
        >
          Ойлголоо
        </button>
      </div>
    </div>
  );
}
