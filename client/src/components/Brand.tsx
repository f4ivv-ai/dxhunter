/**
 * Marque « DX Hunter by F4IVV » : une yagi stylisée et le nom.
 * Dessin original, aucune image externe.
 */
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export function YagiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--card)" stroke="var(--border)" />
      <line x1="6" y1="16" x2="26" y2="16" stroke="var(--foreground)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      {/* éléments aux couleurs des bandes, du réflecteur au dernier directeur */}
      <line x1="8" y1="7" x2="8" y2="25" stroke="var(--band-160)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="12.5" y1="8.5" x2="12.5" y2="23.5" stroke="var(--band-80)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="17" y1="10" x2="17" y2="22" stroke="var(--band-40)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="21.5" y1="11.5" x2="21.5" y2="20.5" stroke="var(--band-20)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M25.5 12.5 Q29.5 16 25.5 19.5" fill="none" stroke="var(--band-10)" strokeWidth="2" strokeLinecap="round" />
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
