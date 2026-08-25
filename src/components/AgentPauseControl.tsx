"use client";

import { CirclePause, LoaderCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentPauseControl({ initialPaused }: { initialPaused: boolean }) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState(initialPaused ? "Las próximas tareas automáticas no usarán créditos." : "El agente puede ejecutar tareas automáticas.");

  async function togglePause() {
    const nextPaused = !paused;
    setUpdating(true);
    setMessage(nextPaused ? "Pausando el uso de créditos…" : "Reanudando el agente…");
    try {
      const response = await fetch("/api/admin/agent-control", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paused: nextPaused }) });
      const result = await response.json() as { paused?: boolean; error?: string };
      if (!response.ok || typeof result.paused !== "boolean") throw new Error(result.error ?? "No pudimos actualizar la pausa.");
      setPaused(result.paused);
      setMessage(result.paused ? "Uso de créditos pausado. Las solicitudes que ya estaban en curso pueden terminar." : "Agente reanudado. El siguiente ciclo volverá a trabajar.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos actualizar la pausa.");
    } finally {
      setUpdating(false);
    }
  }

  return <Card className="gap-5 py-6">
    <CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Uso de créditos</CardTitle>
        <Badge variant={paused ? "outline" : "secondary"}>{paused ? "En pausa" : "Activo"}</Badge>
      </div>
      <CardDescription>{paused ? "El worker omite descubrimiento, verificaciones, reparaciones, auditorías y selección de imágenes con IA." : "Pausa el agente si se agotó el saldo o necesitas detener su trabajo automático."}</CardDescription>
      <CardAction>
        <Button onClick={togglePause} variant={paused ? "secondary" : "outline"} disabled={updating}>
          {updating ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : paused ? <Play data-icon="inline-start" /> : <CirclePause data-icon="inline-start" />}
          {updating ? "Actualizando…" : paused ? "Reanudar agente" : "Pausar uso"}
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message}</p>
    </CardContent>
  </Card>;
}
