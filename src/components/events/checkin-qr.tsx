"use client";

import { QRCodeSVG } from "qrcode.react";

export function CheckinQr({ token, appUrl }: { token: string; appUrl: string }) {
  const base = appUrl.replace(/\/$/, "");
  const url = `${base}/admin/checkin/${token}`;
  return <div className="inline-flex rounded-lg bg-white p-2"><QRCodeSVG value={url} size={150} level="M" /></div>;
}
