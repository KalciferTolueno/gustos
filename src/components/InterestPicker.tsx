"use client";

import { useState } from "react";
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
  return <div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{topics.map((topic) => <Button key={topic.id} onClick={() => toggle(topic.id)} variant={selected.has(topic.id) ? "default" : "outline"} className="h-auto min-h-16 whitespace-normal px-3 py-3 text-left">{selected.has(topic.id) ? "✓ " : "+ "}{topic.name}</Button>)}</div><div className="mt-5 flex items-center justify-between gap-4"><span className="text-sm text-zinc-400" role="status">{message}</span><Button onClick={save}>Guardar selección</Button></div></div>;
}
