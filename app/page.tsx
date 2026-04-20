import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-soft md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                Tailwind + Next.js Editor Source
              </p>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                Simple mobile-friendly print editor starter
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
                Includes templates, layers, drag/resize, direct text edit, smart
                snapping, right settings panel, AI text generation hooks, layout
                suggestion, and PNG/JPG/PDF export.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/editor"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                Open editor
              </Link>
              <p className="max-w-xs text-sm text-slate-500">
                This is a clean starter source. You can connect your own OpenAI
                key and image upload flow next.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
