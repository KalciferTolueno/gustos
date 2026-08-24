import type { CSSProperties } from "react";
import {
  Activity,
  Aperture,
  AudioLines,
  BookOpen,
  Camera,
  Clapperboard,
  Cpu,
  Drama,
  Gamepad2,
  Laugh,
  Palette,
  Plane,
  Shapes,
  Sparkles,
  Telescope,
  UsersRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const themes: Array<{ match: string[]; icon: LucideIcon; hue: number }> = [
  { match: ["gaming"], icon: Gamepad2, hue: 265 },
  { match: ["anime"], icon: Sparkles, hue: 326 },
  { match: ["cine", "pelicula"], icon: Clapperboard, hue: 42 },
  { match: ["musica"], icon: AudioLines, hue: 336 },
  { match: ["astro"], icon: Telescope, hue: 230 },
  { match: ["fotografia"], icon: Camera, hue: 202 },
  { match: ["viaje", "tour"], icon: Plane, hue: 188 },
  { match: ["arte", "cultura"], icon: Palette, hue: 20 },
  { match: ["teatro", "danza"], icon: Drama, hue: 350 },
  { match: ["comedia"], icon: Laugh, hue: 48 },
  { match: ["literatura"], icon: BookOpen, hue: 214 },
  { match: ["gastronomia", "feria"], icon: UtensilsCrossed, hue: 26 },
  { match: ["deporte", "bienestar"], icon: Activity, hue: 145 },
  { match: ["tecnologia", "ciencia"], icon: Cpu, hue: 184 },
  { match: ["familia"], icon: Shapes, hue: 52 },
  { match: ["comunidad"], icon: UsersRound, hue: 286 },
];

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");
}

export function EventImageFallback({ categoryName }: { categoryName: string }) {
  const category = normalized(categoryName);
  const theme = themes.find((item) => item.match.some((word) => category.includes(word))) ?? { icon: Aperture, hue: 190 };
  const Icon = theme.icon;
  return (
    <div
      className="event-placeholder"
      role="img"
      aria-label={`Ilustración temática para ${categoryName}`}
      style={{ "--fallback-hue": theme.hue } as CSSProperties}
    >
      <svg className="event-placeholder-art" viewBox="0 0 800 420" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <circle cx="650" cy="70" r="190" />
        <circle cx="650" cy="70" r="126" />
        <path d="M-30 315 C105 210 190 380 322 270 S542 155 842 290" />
        <path d="M-30 352 C126 248 224 402 358 303 S603 205 842 335" />
      </svg>
      <div className="event-placeholder-mark">
        <span className="event-placeholder-icon"><Icon aria-hidden="true" /></span>
      </div>
    </div>
  );
}
