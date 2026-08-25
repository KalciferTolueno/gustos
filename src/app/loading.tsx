import { DatitoMark } from "@/components/DatitoMark";

export default function Loading() {
  return (
    <main className="min-h-[100dvh] bg-[#0b0c0e] px-4 py-4 text-zinc-100 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando Datito">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex h-16 items-center rounded-2xl border border-white/10 bg-[#141618] px-4 sm:px-6">
          <DatitoMark className="size-9" />
          <span className="ml-2.5 text-lg font-medium">Datito</span>
        </header>
        <div className="grid min-h-[36rem] items-center gap-10 border-b border-white/10 py-12 lg:grid-cols-[1.08fr_.72fr]">
          <div className="grid gap-5">
            <span className="skeleton-line w-40" />
            <span className="skeleton-block h-36 w-full max-w-3xl" />
            <span className="skeleton-line w-full max-w-xl" />
            <span className="skeleton-block mt-2 h-16 w-full max-w-3xl" />
          </div>
          <span className="skeleton-block aspect-[5/4] w-full" />
        </div>
      </div>
    </main>
  );
}
