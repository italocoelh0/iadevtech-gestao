import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Módulo preparado para implementação.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As regras e operações deste módulo serão conectadas ao Prisma nas próximas etapas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
