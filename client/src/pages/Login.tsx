import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio } from "lucide-react";
import { type FormEvent, useState } from "react";

function nextFromQuery(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/app";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, next: nextFromQuery() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Connexion impossible");
        return;
      }
      window.location.href = data.next ?? "/app";
    } catch {
      setError("Serveur injoignable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm space-y-5"
      >
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">DX Hunter — connexion</h1>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe administrateur</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending || !password}>
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}
