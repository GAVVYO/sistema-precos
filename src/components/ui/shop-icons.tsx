/**
 * Ícones próprios da oficina (pedido do usuário: trocar os ícones genéricos).
 * Traço de 1.8 com cantos arredondados + uma mancha de cor suave (duotone),
 * no mesmo desenho da placa: o carro visto de lado, sempre o mesmo carro.
 * Decorativos: quem usa põe aria-hidden e o texto ao lado diz o que é.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** O carro (lado), reaproveitado nos três ícones. */
function Car({ y = 0 }: { y?: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path d="M4.5 21.5v-3.2c0-1 .6-1.8 1.5-2.1l2.6-.8 2.6-3.6c.5-.7 1.3-1.1 2.2-1.1h5.4c.8 0 1.6.4 2.1 1l3 3.6 2.9.8c1 .3 1.7 1.2 1.7 2.2v3.2" fill="currentColor" fillOpacity=".16" />
      <path d="M4.5 21.5h2.3M12.2 21.5h7.6M25.2 21.5h2.3M11.6 15.7h11" />
      <circle cx="9.5" cy="21.8" r="2.4" />
      <circle cx="22.5" cy="21.8" r="2.4" />
    </g>
  );
}

/** Aguardando: carro estacionado com um reloginho. */
export function IconCarWaiting(props: P) {
  return (
    <svg {...base} {...props}>
      <Car y={2} />
      <circle cx="24.5" cy="7.5" r="4.6" fill="currentColor" fillOpacity=".16" />
      <path d="M24.5 5.4v2.3l1.5 1" />
    </svg>
  );
}

/** Em andamento: carro em cima do elevador, com a chave de boca. */
export function IconCarLift(props: P) {
  return (
    <svg {...base} {...props}>
      <Car y={-3} />
      <path d="M7 24.5h18M10 24.5v4M22 24.5v4M6 28.5h20" />
      <path d="M25.6 4.2a2.6 2.6 0 0 0-3.3 3.3l-3 3 1.2 1.2 3-3a2.6 2.6 0 0 0 3.3-3.3l-1.5 1.5-1.2-.3-.3-1.2z" fill="currentColor" fillOpacity=".16" />
    </svg>
  );
}

/** Pronto: carro com a bandeirinha de concluído. */
export function IconCarReady(props: P) {
  return (
    <svg {...base} {...props}>
      <Car y={2} />
      <path d="M21.5 11V3.5" />
      <path d="M21.5 3.8h6.2l-1.6 2.3 1.6 2.3h-6.2z" fill="currentColor" fillOpacity=".16" />
    </svg>
  );
}

/** Filtro: dois botões de régua (como o ajuste de um painel). */
export function IconTune(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M5 10h13M24 10h3M5 22h3M14 22h13" />
      <circle cx="21" cy="10" r="3" fill="currentColor" fillOpacity=".16" />
      <circle cx="11" cy="22" r="3" fill="currentColor" fillOpacity=".16" />
    </svg>
  );
}

/** Busca: lupa com brilho. */
export function IconSearch(props: P) {
  return (
    <svg {...base} {...props}>
      <circle cx="14" cy="14" r="8" fill="currentColor" fillOpacity=".1" />
      <path d="M20 20l6.5 6.5M10.5 11.5a4.5 4.5 0 0 1 3-2.5" />
    </svg>
  );
}
