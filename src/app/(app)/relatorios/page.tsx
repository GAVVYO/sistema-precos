import { redirect } from "next/navigation";

/** A antiga tela de Relatórios/Desempenho virou a aba Resultados do Financeiro (decisão 79). */
export default function Page() {
  redirect("/financeiro");
}
