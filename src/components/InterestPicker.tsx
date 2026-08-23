"use client";

import { useState } from "react";
import Link from "next/link";

type Topic = { id: number; name: string; type: string };

export function InterestPicker({ topics, initial }: { topics: Topic[]; initial: number[] }) {
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
    setMessage(response.ok ? "Gustos guardados" : "No pudimos guardar tus gustos");
  }
  return <main className="interest-page"><div className="interest-header"><span>PERSONALIZA TU RADAR</span><h1>¿Qué te mueve?</h1><p>El agente priorizará estas señales al buscar eventos en Chile.</p></div><div className="interest-grid">{topics.map((topic) => <button key={topic.id} onClick={() => toggle(topic.id)} className={selected.has(topic.id) ? "selected" : ""}><small>{topic.type}</small><b>{topic.name}</b><i>{selected.has(topic.id) ? "✓" : "+"}</i></button>)}</div><div className="interest-actions"><Link href="/">Cancelar</Link><span>{message}</span><button onClick={save}>Guardar selección</button></div></main>;
}
