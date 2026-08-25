import Link from "next/link";
import { DatitoMark } from "@/components/DatitoMark";

export default function NotFound() {
  return (
    <main id="main-content" className="grid min-h-[100dvh] place-items-center bg-[#0b0c0e] px-6 text-zinc-100">
      <section className="max-w-xl text-center" aria-labelledby="not-found-title">
        <DatitoMark className="mx-auto size-14" />
        <p className="mt-8 text-sm font-medium text-[#d9ff81]">Página no encontrada</p>
        <h1 id="not-found-title" className="mt-3 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Este panorama no está acá</h1>
        <p className="mx-auto mt-5 max-w-md text-pretty leading-7 text-zinc-400">Vuelve al radar para explorar eventos actuales y futuros en Chile.</p>
        <Link className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-100 px-5 font-medium text-zinc-950 transition-transform duration-200 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-px active:translate-y-0 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9ff81]" href="/">Volver a explorar</Link>
      </section>
    </main>
  );
}
