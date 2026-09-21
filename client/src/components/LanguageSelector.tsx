import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de langue compact avec drapeaux.
 * Affiche le drapeau actuel, et un dropdown au clic avec tous les drapeaux.
 */
export function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-sm transition-all hover:border-primary/50 active:scale-[0.97]"
        title={current.label}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <svg
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-col rounded border border-border bg-card shadow-lg">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLocale(l.code as Locale);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                l.code === locale && "bg-accent/50 font-medium"
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="whitespace-nowrap text-foreground">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
