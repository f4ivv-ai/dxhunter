/**
 * Afficheur LCD 7 segments (police DSEG7) avec segments éteints en fond.
 * Réservé aux grandeurs lues d'un coup d'œil : heure UTC, fréquences VFO.
 */
import { cn } from "@/lib/utils";

type LcdProps = {
  /** Valeur affichée : chiffres, « : », « . », « - » et espaces. */
  value: string;
  /** Unité ou suffixe en petit (« UTC », « kHz », « Z »…). */
  unit?: string;
  tone?: "phosphor" | "amber" | "off";
  /** Taille de police des chiffres (classe Tailwind), ex. « text-xl ». */
  size?: string;
  className?: string;
  title?: string;
};

/** DSEG : « ! » = case vide de la largeur d'un chiffre, « 8 » = tous segments. */
export function lcdText(value: string): { shown: string; ghost: string } {
  const shown = value.replace(/ /g, "!");
  const ghost = shown.replace(/[0-9-]/g, "8").replace(/!/g, "8");
  return { shown, ghost };
}

export function Lcd({ value, unit, tone = "phosphor", size = "text-xl", className, title }: LcdProps) {
  const { shown, ghost } = lcdText(value);
  return (
    <span className={cn("lcd", className)} data-tone={tone} title={title} role="img" aria-label={`${value}${unit ? ` ${unit}` : ""}`}>
      <span className={cn("lcd-digits", size)} data-ghost={ghost} aria-hidden="true">
        <span>{shown}</span>
      </span>
      {unit && (
        <span className="lcd-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </span>
  );
}
