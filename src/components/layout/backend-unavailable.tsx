import { ServerOff } from "lucide-react";

/**
 * Exibido quando a aplicação está em modo produção sem backend configurado.
 * Não há fallback para os dados de demonstração.
 */
export function BackendUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-md border border-line bg-surface p-8 text-center">
        <ServerOff className="mx-auto mb-3 size-10 text-slate-400" aria-hidden />
        <h1 className="text-lg font-semibold">Ambiente indisponível</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          O ambiente de produção do GAVYO Auto ainda não está configurado. O banco de dados e a
          autenticação reais serão ativados em uma próxima etapa. Nenhum dado de demonstração é
          exibido neste modo.
        </p>
        <p className="mt-3 text-xs text-muted">Em caso de dúvida, fale com a equipe da GAVYO.</p>
      </div>
    </main>
  );
}
