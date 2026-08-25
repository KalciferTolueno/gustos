"use client";

import { DatitoMark } from "@/components/DatitoMark";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="grid min-h-[100dvh] place-items-center bg-[#0b0c0e] px-6 text-zinc-100">
      <section className="max-w-xl text-center" aria-labelledby="error-title">
        <DatitoMark className="mx-auto size-14" />
        <p className="mt-8 text-sm font-medium text-[#d9ff81]">Conexión interrumpida</p>
        <h1 id="error-title" className="mt-3 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">No pudimos cargar el radar</h1>
        <p className="mx-auto mt-5 max-w-md text-pretty leading-7 text-zinc-400">Intenta nuevamente. Si el problema continúa, revisa la conexión del servidor.</p>
        <Button className="mt-8" onClick={reset}>Intentar nuevamente</Button>
      </section>
    </main>
  );
}
