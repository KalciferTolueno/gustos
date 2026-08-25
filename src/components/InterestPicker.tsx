"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Aperture, AudioLines, BookOpen, Camera, Check, Clapperboard, Cpu, Drama, Gamepad2, Laugh, Palette, Plane, Plus, Sparkles, Telescope, UsersRound, UtensilsCrossed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type InterestTopic = { id: number; name: string; slug: string; type: string; parentId: number | null; searchEnabled: boolean };
type CustomInterestKind = "artist" | "topic";
type CustomInterest = { key: string; name: string; type: CustomInterestKind };

const categoryIcons: Record<string, LucideIcon> = {
  gaming: Gamepad2, anime: Sparkles, cine: Clapperboard, musica: AudioLines, fotografia: Camera, astrofotografia: Telescope, viajes: Plane,
  "arte-cultura": Palette, "teatro-danza": Drama, comedia: Laugh, literatura: BookOpen, "gastronomia-ferias": UtensilsCrossed,
  "deportes-bienestar": Activity, "tecnologia-ciencia": Cpu, familia: Aperture, comunidad: UsersRound,
};

function normalized(value: string) { return value.trim().replace(/\s+/g, " "); }

export function InterestPicker({ topics, initial }: { topics: InterestTopic[]; initial: number[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(initial));
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [customName, setCustomName] = useState("");
  const [customKind, setCustomKind] = useState<CustomInterestKind>("artist");
  const [customInterests, setCustomInterests] = useState<CustomInterest[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Elige categorías y señales para afinar tus recomendaciones.");
  const visibleTopics = useMemo(() => topics.filter((topic) => topic.searchEnabled || selected.has(topic.id)), [selected, topics]);
  const categories = useMemo(() => visibleTopics.filter((topic) => topic.type === "category"), [visibleTopics]);
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0] ?? null;
  const signals = activeCategory ? visibleTopics.filter((topic) => topic.parentId === activeCategory.id && topic.searchEnabled) : [];
  const savedCustomInterests = visibleTopics.filter((topic) => !topic.searchEnabled && selected.has(topic.id));
  const selectedCount = selected.size + customInterests.length;

  function toggle(id: number) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function addCustomInterest() {
    const name = normalized(customName);
    if (name.length < 2) { setMessage("Escribe al menos 2 caracteres para agregar una señal."); return; }
    const duplicate = [...savedCustomInterests, ...customInterests].some((interest) => interest.name.localeCompare(name, "es-CL", { sensitivity: "base" }) === 0);
    if (duplicate) { setMessage(`“${name}” ya está en tu radar.`); return; }
    setCustomInterests((current) => [...current, { key: `${customKind}-${name.toLocaleLowerCase("es-CL")}`, name, type: customKind }]);
    setCustomName(""); setMessage(`“${name}” se agregará al guardar.`);
  }
  async function save() {
    setSaving(true); setMessage("Guardando tus señales…");
    try {
      const response = await fetch("/api/interests", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ topicIds: [...selected], customInterests: customInterests.map(({ name, type }) => ({ name, type })) }) });
      const result = await response.json().catch(() => null) as { saved?: number; topicIds?: number[]; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "No pudimos guardar tus intereses.");
      setSelected(new Set(result?.topicIds ?? selected)); setCustomInterests([]); const count = result?.saved ?? selectedCount;
      setMessage(`${count} señal${count === 1 ? "" : "es"} guardada${count === 1 ? "" : "s"}. Tu radar ya está listo.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos guardar tus intereses."); } finally { setSaving(false); }
  }

  return <div className="flex min-h-0 flex-col gap-7">
    <section className="rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5" aria-labelledby="selected-interests-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="selected-interests-title" className="text-sm font-semibold text-zinc-100">Tu radar</h3><p className="mt-1 text-sm text-zinc-400">{selectedCount ? `${selectedCount} señal${selectedCount === 1 ? "" : "es"} elegida${selectedCount === 1 ? "" : "s"}` : "Aún no has elegido señales"}</p></div>{selectedCount > 0 && <Button variant="ghost" size="sm" onClick={() => { setSelected(new Set()); setCustomInterests([]); setMessage("Se limpiaron las señales. Guarda para aplicar el cambio."); }}>Limpiar</Button>}</div>
      {selectedCount > 0 ? <div className="mt-4 flex flex-wrap gap-2">{visibleTopics.filter((topic) => selected.has(topic.id)).map((topic) => <Button key={topic.id} variant="secondary" size="sm" className="max-w-full" onClick={() => toggle(topic.id)} aria-label={`Quitar ${topic.name}`}><span className="truncate">{topic.name}</span><X aria-hidden="true" data-icon="inline-end" /></Button>)}{customInterests.map((interest) => <Button key={interest.key} variant="secondary" size="sm" className="max-w-full" onClick={() => setCustomInterests((current) => current.filter((item) => item.key !== interest.key))} aria-label={`Quitar ${interest.name}`}><span className="truncate">{interest.name}</span><X aria-hidden="true" data-icon="inline-end" /></Button>)}</div> : <p className="mt-4 text-sm text-zinc-500">Parte por una categoría o agrega una señal propia.</p>}
    </section>
    <section aria-labelledby="categories-title"><div className="flex flex-col gap-1"><h3 id="categories-title" className="text-base font-semibold text-zinc-100">Explora por categoría</h3><p className="text-sm leading-6 text-zinc-400">Marca una categoría para priorizarla. Luego elige las señales concretas que más te interesan.</p></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{categories.map((category) => { const Icon = categoryIcons[category.slug] ?? Aperture; const isSelected = selected.has(category.id); return <Button key={category.id} type="button" onClick={() => { setActiveCategoryId(category.id); toggle(category.id); }} aria-pressed={isSelected} variant={isSelected ? "default" : "outline"} size="sm" className="h-10 min-w-0 justify-start rounded-xl px-3"><Icon aria-hidden="true" data-icon="inline-start" /><span className="truncate">{category.name}</span>{isSelected && <Check aria-hidden="true" className="ml-auto" data-icon="inline-end" />}</Button>; })}</div></section>
    <section className="border-t border-white/10 pt-6" aria-labelledby="signals-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="signals-title" className="text-base font-semibold text-zinc-100">{activeCategory ? `Afina ${activeCategory.name}` : "Afina tu radar"}</h3><p className="mt-1 text-sm text-zinc-400">Elige las actividades y estilos que quieres encontrar antes.</p></div>{activeCategory && <span className="text-xs font-medium text-zinc-500">{signals.length} señales</span>}</div>{signals.length ? <div className="mt-4 flex flex-wrap gap-2">{signals.map((signal) => { const isSelected = selected.has(signal.id); return <Button key={signal.id} onClick={() => toggle(signal.id)} aria-pressed={isSelected} variant={isSelected ? "default" : "outline"} size="sm" className="h-9 rounded-full">{isSelected && <Check aria-hidden="true" data-icon="inline-start" />}{signal.name}</Button>; })}</div> : <p className="mt-4 text-sm text-zinc-500">No hay señales sugeridas para esta categoría todavía.</p>}</section>
    <section className="border-t border-white/10 pt-6" aria-labelledby="custom-interests-title"><div><h3 id="custom-interests-title" className="text-base font-semibold text-zinc-100">Agrega algo muy tuyo</h3><p className="mt-1 text-sm leading-6 text-zinc-400">Sigue artistas, bandas, juegos, sagas, fandoms o cualquier señal que no esté arriba.</p></div><div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"><Input value={customName} onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomInterest(); } }} name="custom-interest" autoComplete="off" maxLength={80} placeholder="Ej.: Mon Laferte, Dune, Fórmula 1…" aria-label="Nueva señal personalizada" className="h-11 bg-white/[.03] text-zinc-100 placeholder:text-zinc-500" /><Select value={customKind} onValueChange={(value) => setCustomKind(value as CustomInterestKind)}><SelectTrigger aria-label="Tipo de señal personalizada" className="h-11 bg-white/[.03] text-zinc-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="artist">Artista o banda</SelectItem><SelectItem value="topic">Juego, saga u otro</SelectItem></SelectContent></Select><Button onClick={addCustomInterest} className="h-11"><Plus aria-hidden="true" data-icon="inline-start" />Agregar</Button></div></section>
    <div className="sticky bottom-0 -mx-6 flex flex-col gap-3 border-t border-white/10 bg-popover/95 px-6 pb-1 pt-4 backdrop-blur sm:-mx-8 sm:px-8 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-zinc-400" role="status" aria-live="polite">{message}</p><Button onClick={save} disabled={saving} className="shrink-0">{saving ? "Guardando…" : "Guardar cambios"}</Button></div>
  </div>;
}
