import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";

/** Bascule jour / nuit. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary",
        className,
      )}
      title={dark ? "Passer en mode jour" : "Passer en mode nuit"}
      aria-label={dark ? "Passer en mode jour" : "Passer en mode nuit"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
