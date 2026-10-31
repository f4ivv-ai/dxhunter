/**
 * Marque « DX Hunter by F4IVV » : une yagi stylisée et le nom.
 * Dessin original, aucune image externe.
 */
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export function YagiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="4" fill="#061109" stroke="#1d2f24" />
      {/* boom */}
      <line x1="6" y1="16" x2="26" y2="16" stroke="#3dff7f" strokeWidth="1.6" strokeLinecap="round" />
      {/* éléments : réflecteur, radiateur, directeurs */}
      <line x1="8" y1="7" x2="8" y2="25" stroke="#3dff7f" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="13" y1="8.5" x2="13" y2="23.5" stroke="#3dff7f" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18" y1="10" x2="18" y2="22" stroke="#3dff7f" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="23" y1="11.5" x2="23" y2="20.5" stroke="#3dff7f" strokeWidth="1.6" strokeLinecap="round" />
      {/* lobe de rayonnement */}
      <path d="M26 12.5 Q30 16 26 19.5" fill="none" stroke="#ffb020" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

type BrandProps = {
  /** Sous-titre de la page (« Écoute DX », « Documentation »…). */
  section?: string;
  className?: string;
  href?: string;
};

export function Brand({ section, className, href = "/app" }: BrandProps) {
  return (
    <Link href={href} className={cn("group flex shrink-0 items-center gap-2.5", className)} title="DX Hunter by F4IVV">
      <YagiMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight text-foreground">
          DX Hunter <span className="font-mono text-[11px] font-medium text-muted-foreground">by F4IVV</span>
        </span>
        {section && <span className="mt-0.5 text-[11px] font-medium text-primary">{section}</span>}
      </span>
    </Link>
  );
}
