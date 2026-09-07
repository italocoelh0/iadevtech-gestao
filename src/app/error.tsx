"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application error", { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar esta página</h1>
        <p className="text-sm text-muted-foreground">
          A operação foi interrompida de forma segura. Tente novamente; se o problema persistir, informe o horário e a tela acessada ao administrador.
        </p>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </main>
  );
}
