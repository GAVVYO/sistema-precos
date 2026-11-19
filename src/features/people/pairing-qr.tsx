"use client";

import { ArrowClockwise, DeviceMobileCamera } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { demoStore } from "@/demo/store";
import { createPairing, type PairingInput } from "@/services/pairing";
import { DomainError } from "@/services/core";

/**
 * QR para conectar o celular (decisão 76). Vale 10 minutos; ao vencer fica
 * apagado com "Gerar outro". O QR "se desenha" de cima para baixo ao aparecer,
 * como uma leitura, e uma moldura marca onde apontar a câmera.
 */
export function PairingQr({ input, who }: { input: PairingInput; who: string }) {
  const [qr, setQr] = useState<{ src: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const generate = useCallback(() => {
    // Tudo dentro da promessa: os estados só mudam quando o QR fica pronto (ou falha).
    Promise.resolve()
      .then(() => {
        const s = demoStore.getState();
        if (!s.session) throw new DomainError("forbidden", "Entre de novo para gerar o QR.");
        const { code, expiresAt } = createPairing(s.db, { ...s.session, now: new Date() }, input);
        return QRCode.toDataURL(code, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#0d2a78", light: "#ffffff" } }).then((src) => ({ src, expiresAt }));
      })
      .then((v) => { setQr(v); setNow(Date.now()); setError(null); })
      .catch((e) => setError(e instanceof DomainError ? e.message : "Não deu para gerar o QR. Tente de novo."));
    // input muda só quando muda a pessoa (chave do componente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { generate(); }, [generate]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = qr ? Math.max(0, qr.expiresAt - now) : 0;
  const expired = !!qr && left === 0;
  const mm = Math.floor(left / 60_000), ss = Math.floor((left % 60_000) / 1000);

  if (error) return <p className="pair-error" role="alert">{error}</p>;

  return (
    <div className="pair">
      <div className="pair-code" data-expired={expired || undefined}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={qr.src} src={qr.src} alt={`QR para conectar o celular ${input.kind === "device" ? "da oficina" : `de ${who}`}`} className="pair-img" />
        ) : <span className="pair-img pair-skel" aria-hidden />}
        <span className="pair-frame" aria-hidden />
        {expired && (
          <button type="button" className="pair-renew" onClick={generate}>
            <ArrowClockwise size={22} weight="bold" aria-hidden /> Gerar outro
          </button>
        )}
      </div>
      <div className="pair-text">
        <p className="pair-title"><DeviceMobileCamera size={22} weight="duotone" aria-hidden /> {input.kind === "device" ? "Conectar o aparelho da oficina" : `Conectar o celular de ${who}`}</p>
        <ol className="pair-steps">
          <li>Abra o app <strong>GAVYO</strong> no {input.kind === "device" ? "celular ou tablet do balcão" : "celular da pessoa"}.</li>
          <li>Toque em <strong>Conectar</strong> e aponte a câmera para o QR.</li>
          <li>{input.kind === "device" ? "Pronto: cada um entra tocando no nome e digitando o PIN." : "Pronto: já entra. Nas próximas vezes, abre com a digital ou o PIN."}</li>
        </ol>
        <p className="pair-timer" aria-live="polite">{expired ? "Este QR venceu." : `Vale por ${mm}:${String(ss).padStart(2, "0")} e só funciona uma vez.`}</p>
      </div>
    </div>
  );
}
