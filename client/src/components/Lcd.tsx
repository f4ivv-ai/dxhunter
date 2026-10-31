/**
 * Lecture numérique : heure UTC, fréquence VFO.
 * Chiffres à chasse fixe sur une pastille teintée, lisibles de jour comme de nuit.
 */
import { cn } from "@/lib/utils";

type LcdProps = {
  value: string;
  /** Unité en petit (« UTC », « MHz »…). */
  unit?: string;
  tone?: "default" | "amber" | "off";
  /** Taille des chiffres (classe Tailwind), ex. « text-xl ». */
  size?: string;
  className?: string;
  title?: string;
};

export function Lcd({ value, unit, tone = "default", size = "text-lg", className, title }: LcdProps) {
  return (
    <span className={cn("readout", className)} data-tone={tone} title={title}>
      <span className={cn("readout-value", size)}>{value.trimStart()}</span>
      {unit && <span className="readout-unit">{unit}</span>}
    </span>
  );
}
