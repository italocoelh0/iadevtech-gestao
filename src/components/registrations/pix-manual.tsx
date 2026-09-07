"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

export function PixManual({ pixKey }: { pixKey: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(pixKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <div className="space-y-4 text-center"><div className="mx-auto w-fit rounded-xl border bg-white p-4"><QRCodeSVG value={pixKey} size={190} level="M" /></div><div><p className="text-xs text-muted-foreground">Chave PIX</p><p className="mt-1 break-all font-mono text-sm font-medium">{pixKey}</p></div><Button type="button" variant="outline" onClick={copy}>{copied?<Check className="mr-2 h-4 w-4"/>:<Copy className="mr-2 h-4 w-4"/>}{copied?"Chave copiada":"Copiar chave PIX"}</Button><p className="text-xs text-muted-foreground">O pagamento não é identificado automaticamente. Após pagar, aguarde a confirmação administrativa.</p></div>;
}
