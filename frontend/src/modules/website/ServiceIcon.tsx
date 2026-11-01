import { BrickWall, Building2, DoorOpen, Droplets, Fence, Grid2x2, House, Layers, PaintRoller, Paintbrush, Palette, ShieldCheck, Sparkles, SprayCan, ThermometerSun, Scroll, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Gleiche Symbole wie auf der Website (frontend/api/site.ts, SERVICE_ICONS) */
const ICONS: Record<string, LucideIcon> = {
  rolle: PaintRoller,
  pinsel: Paintbrush,
  haus: House,
  tapete: Scroll,
  spachtel: Layers,
  boden: Grid2x2,
  tuer: DoorOpen,
  schutz: ShieldCheck,
  daemmung: ThermometerSun,
  mauer: BrickWall,
  spray: SprayCan,
  palette: Palette,
  gewerbe: Building2,
  holz: Fence,
  wasser: Droplets,
  werkzeug: Wrench,
  stern: Sparkles,
};

export function ServiceIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? PaintRoller;
  return <Icon size={size} aria-hidden="true" />;
}
