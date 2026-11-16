# Arquitetura

Aplicação única (monólito modular) em Next.js: frontend e, na Fase 2, backend no mesmo projeto. Sem microsserviços, Docker, Redis ou WebSockets.

## Camadas

```
Interface (src/app, src/features, src/components)
        │  usa apenas useApp(): view (leitura) e act() (escrita)
        ▼
Estado da aplicação (src/app-state)        ← sessão, oficina ativa, permissões, conexão
        ▼
Regras de negócio (src/services)           ← funções puras: (db, ctx, input) → resultado
        ▼
Persistência
  Fase 1: src/demo/store.ts  (memória + localStorage)
  Fase 2: Prisma + MySQL     (prisma/schema.prisma)
```

A interface **nunca** altera dados diretamente nem contém regras de negócio ou dados fixos: tudo passa pelos serviços.

## Pastas

| Pasta | Conteúdo |
| --- | --- |
| `src/app` | Rotas (App Router). `(app)/` é a área logada; `login/` é o acesso de demonstração. |
| `src/features/<módulo>` | Telas e modais de cada módulo (dashboard, orders, stock, finance, schedule, customers, reports, settings). |
| `src/components/ui` | Design system: botões, campos, modal, abas, avisos, seletor de período. |
| `src/components/layout` | Cabeçalho, barra de demonstração, aviso offline, guarda de módulo. |
| `src/app-state` | Contexto React: oficina ativa, usuário, permissões, `act()`. |
| `src/domain` | Modelos TypeScript, permissões/cargos/módulos, rótulos. Sem dependência de React. |
| `src/services` | Regras de negócio e validações (Zod). Testáveis em Node. |
| `src/demo` | Seed fictício e store local. **Único código exclusivo da demonstração.** |
| `src/lib` | Formatação (moeda, datas, telefone, placa), WhatsApp, exportações. |
| `src/config` | Modo da aplicação (demo/produção). |
| `prisma` | Schema MySQL previsto para a Fase 2. |
| `tests` | Testes automatizados dos fluxos principais. |

## Design system e personalização

Tokens em `src/app/globals.css` (`--primary`, `--secondary`, `--bg`, `--border`…), expostos ao Tailwind via `@theme`. O `AppShell` sobrescreve `--primary`/`--secondary` com as cores da oficina ativa e calcula a cor do texto por contraste. Não existe CSS nem código por cliente.

## Serviços e contexto de execução

Toda operação de escrita tem a forma `fn(db, ctx, input)`, onde `ctx = { workshopId, userId, now }`:

1. `assertCan(db, ctx, permissão)` — autorização;
2. validação da entrada com Zod;
3. `findScoped(...)` — todo registro é buscado por `id` **e** `workshopId`;
4. alteração dos dados.

Na demonstração, `demoStore.mutate()` executa a função sobre uma **cópia** do banco e só confirma se ela terminar sem erro — o equivalente local de uma transação. Na Fase 2, o mesmo corpo roda dentro de `prisma.$transaction`.

## Multiempresa

- Toda entidade de negócio tem `workshopId`.
- **Leitura:** a interface só enxerga `scopeTo(db, workshopId)` — a visão já filtrada.
- **Escrita:** `findScoped` impede operar ou referenciar registros de outra oficina; numeração de OS, códigos de peça e placas são únicos por oficina.
- **Fase 2:** o `ctx` será montado no servidor a partir da sessão (nunca de um `workshopId` enviado pelo navegador). Como o MySQL não tem RLS, o isolamento é garantido por: acesso centralizado aos dados, chaves/FKs compostas `[workshopId, id]` (ver schema) e testes automatizados de isolamento (já existentes em `tests/services.test.ts`).

## Permissões

`src/domain/permissions.ts` define as permissões, os modelos por cargo e os módulos. O cargo é só o modelo inicial; valem as permissões gravadas em `WorkshopMembership.permissions`. A interface oculta/desabilita o que o usuário não pode fazer, **e os serviços recusam a operação de qualquer forma** — ocultar botão não é segurança. Regras contra elevação de privilégio ficam em `src/services/admin.ts`.

## Estoque e financeiro

- `applyStockDelta` é o único ponto que altera quantidades: gera a movimentação e recusa saldo negativo.
- `setOrderItems` compara a lista nova com a atual e movimenta só a diferença; OS concluída exige motivo de correção; OS paga é imutável.
- Concluir OS não movimenta estoque. Cancelar devolve peças apenas se indicado.
- `registerPayment` cria `Payment` + receita numa única operação; segunda tentativa é recusada.
- Valores sempre em centavos inteiros. "Resultado de caixa" = recebido − despesas pagas (não é lucro contábil).

## Ambientes

`NEXT_PUBLIC_APP_MODE` define `demo` (padrão) ou `production`. Em `production`, enquanto o backend não existir, a aplicação mostra "Ambiente indisponível" — não há fallback para os dados de demonstração.

## Offline (leitura)

Fase 1 simula os estados online / offline / reconectando (botão na barra de demonstração e eventos reais do navegador). Offline: leitura liberada, data da última atualização exibida, toda escrita bloqueada na interface e no store. Sem fila de alterações nem sincronização bidirecional.

Fase 3: Service Worker + IndexedDB, com cache separado por oficina e usuário, limpo ao sair ou trocar de oficina, com validade definida, sem credenciais e restrito aos dados que o usuário pode ver.
