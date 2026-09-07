import type { Metadata } from "next";
import { Suspense } from "react";
import { GlobalLoadingProvider } from "@/components/system/global-loading";
import "./globals.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestão de Empresa",
  description: "Sistema integrado de gestão, eventos, estoque, financeiro e comandas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <Suspense fallback={children}>
          <GlobalLoadingProvider>{children}</GlobalLoadingProvider>
        </Suspense>
      </body>
    </html>
  );
}
