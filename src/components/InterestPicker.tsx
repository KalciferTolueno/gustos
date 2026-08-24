"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type InterestTopic = { id: number; name: string; type: string };

export function InterestPicker({ topics, initial }: { topics: InterestTopic[]; initial: number[] }) {
  const [selected, setSelected] = useState(new Set(initial));
  const [message, setMessage] = useState("");
  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function save() {
    const response = await fetch("/api/interests", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ topicIds: [...selected] }) });
    setMessage(response.ok ? "Intereses guardados" : "No pudimos guardar tus intereses");
  }
  return <div>
    <p id="interest-picker-description" className="mb-3 text-sm leading-6 text-zinc-400">Elige los temas que quieres ver primero. Puedes cambiar esta selección cuando quieras.</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-describedby="interest-picker-description">
      {topics.map((topic) => {
        const isSelected = selected.has(topic.id);
        return <Button key={topic.id} onClick={() => toggle(topic.id)} aria-pressed={isSelected} variant={isSelected ? "default" : "outline"} className="h-auto min-h-16 whitespace-normal px-3 py-3 text-left">
          {isSelected ? <Check data-icon="inline-start" /> : <Plus data-icon="inline-start" />}{topic.name}
        </Button>;
      })}
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-zinc-400" role="status" aria-live="polite">{message}</span>
      <Button onClick={save}>Guardar Selección</Button>
    </div>
  </div>;
}
