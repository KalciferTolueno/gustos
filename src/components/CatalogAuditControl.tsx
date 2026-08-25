"use client";

import { LoaderCircle, ScanSearch, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuditResult = {
  version: number;
  checked: number;
  completed: number;
  quarantined: number;
  remaining: number;
};

export function CatalogAuditControl({ version, initialRemaining, paused }: { version: number; initialRemaining: number; paused: boolean }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(initialRemaining);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(paused ? "La auditoría está detenida mientras el uso de créditos esté en pausa." : initialRemaining ? "Lista para revisar el siguiente registro." : "Todos los eventos alcanzaron la versión actual.");

  async function runAudit() {
    if (paused) {
      setMessage("Reanuda el uso de créditos antes de ejecutar una auditoría.");
      return;
    }
    setRunning(true);
    setMessage("Revisando fuente, vigencia, imagen y ubicación…");
    try {
      const response = await fetch("/api/admin/catalog-audit", { method: "POST" });
      const result = await response.json() as AuditResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No pudimos ejecutar la auditoría.");
      setRemaining(result.remaining);
      if (!result.checked) setMessage(result.remaining ? "Otra auditoría está trabajando. Inténtalo nuevamente en unos minutos." : "El catálogo ya está al día.");
      else if (result.quarantined) setMessage("Se retiró un evento con una fuente inválida y quedó pendiente de reparación.");
      else if (result.completed) setMessage("Evento revisado y aprobado por todas las reglas actuales.");
      else setMessage("La revisión quedó incompleta y se reintentará automáticamente.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos ejecutar la auditoría.");
    } finally {
      setRunning(false);
    }
  }

  return <Card className="gap-5 py-6">
    <CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Auditoría integral del catálogo</CardTitle>
        <Badge variant={remaining ? "outline" : "secondary"}>Versión {version}</Badge>
      </div>
      <CardDescription>Revisa un evento por ejecución y valida todas sus fuentes, fechas, imagen y ubicación. El worker continuará con el resto automáticamente.</CardDescription>
      <CardAction>
        <Button onClick={runAudit} disabled={running || remaining === 0 || paused}>
          {running ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : remaining ? <ScanSearch data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
          {running ? "Auditando…" : paused ? "Pausa activa" : remaining ? "Auditar siguiente" : "Catálogo al día"}
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground"><strong className="font-semibold tabular-nums text-foreground">{remaining}</strong> evento{remaining === 1 ? "" : "s"} pendiente{remaining === 1 ? "" : "s"} de esta versión</p>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message}</p>
    </CardContent>
  </Card>;
}
