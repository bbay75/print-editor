import EditorShell from "@/components/editor/EditorShell";

export default function EditorPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* 🔥 TOP HEADER */}
      <div className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="NEGUN design"
            className="h-10 w-10 object-contain"
          />
          <div className="text-xl font-bold text-blue-600">
            NEGUN <span className="text-slate-900">design</span>
          </div>
        </div>
      </div>

      {/* 🔥 EDITOR */}
      <div className="p-4">
        <EditorShell />
        <div className="mt-10 border-t pt-6 text-center text-sm text-slate-500 space-y-1">
          <div> Хөгжүүлэгч NEGUN design © {new Date().getFullYear()}</div>
          <div>
            Хиймэл оюун ухаанаар ажилладаг хэвлэх редактор · CMYK хэвлэхэд бэлэн
            · Монголд үйлдвэрлэв
          </div>
        </div>
      </div>
    </div>
  );
}
