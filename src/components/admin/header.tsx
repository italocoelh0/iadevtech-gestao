import { Bell, LogOut, Menu, UserCircle } from "lucide-react";
import { auth, signOut } from "@/../auth";
import { Button } from "@/components/ui/button";

export async function AdminHeader() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <p className="font-medium">Painel administrativo</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Gestão integrada
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 pr-2 text-right sm:flex">
          <UserCircle className="h-7 w-7 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{session?.user?.name ?? "Usuário"}</p>
            <p className="text-xs text-muted-foreground">{roles.join(" · ")}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-5 w-5" />
        </Button>
        <form action={logout}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </header>
  );
}
