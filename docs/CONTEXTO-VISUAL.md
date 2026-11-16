# Contexto para o trabalho de melhoria visual

Documento de passagem para quem for refinar a interface do GAVYO Auto. Leia também [ARQUITETURA.md](ARQUITETURA.md) e [FUNCIONALIDADES.md](FUNCIONALIDADES.md).

## O que é o projeto

ERP para pequenas oficinas mecânicas (Passaré, Fortaleza). **Fase 1: frontend de demonstração**, sem backend — os dados são fictícios e ficam no `localStorage`. Todas as telas e fluxos já funcionam; o objetivo agora é **elevar a qualidade visual sem quebrar comportamento**.

Stack: Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, Lucide, dnd-kit, Recharts.

> O Next 16 tem mudanças em relação a versões anteriores. Antes de mexer em APIs do framework, consulte `node_modules/next/dist/docs/` (ver `AGENTS.md`).

## Como rodar e validar

```bash
npm install
npm run dev        # http://localhost:3000 — escolha oficina e usuário (sem senha)
npm run typecheck && npm run lint && npm test && npm run build
```

Os quatro comandos acima passam hoje e devem continuar passando. Os 32 testes cobrem regras de negócio e exportações, **não a interface** — mudanças visuais precisam ser conferidas no navegador.

## Onde fica a parte visual

| O quê | Arquivo |
| --- | --- |
| Tokens (cores, fonte, raio), estilo de tabela `.data-table` | `src/app/globals.css` |
| Botão, campos, Field, Card, PageHeader, Badge, Stat, EmptyState, Tabs, Segmented, Skeleton | `src/components/ui/primitives.tsx` |
| Modal e confirmação (`<dialog>` nativo) | `src/components/ui/dialog.tsx` |
| Avisos (toasts, em `popover`) | `src/components/ui/toast.tsx` |
| Seletor de período | `src/components/ui/period.tsx` |
| Cabeçalho, barra de demonstração, faixa offline, guarda de módulo | `src/components/layout/app-shell.tsx` |
| Tela de acesso | `src/app/login/page.tsx` |
| Telas de cada módulo | `src/features/<módulo>/*.tsx` |

Telas: `dashboard`, `orders` (Kanban, Nova OS, detalhes, pagamento, WhatsApp), `stock`, `finance`, `schedule`, `customers`, `reports`, `settings`.

## Direção visual definida pelo cliente

- Claro, profissional: **branco, cinza e azul**. Familiaridade de software de gestão tradicional com acabamento moderno.
- Paleta base: fundo `#F4F6F9`, superfície `#FFFFFF`, primária `#2563EB`, texto `#172033`, texto secundário `#64748B`, borda `#E2E8F0`. Verde = sucesso, âmbar = atenção, vermelho = erro/crítico.
- Priorizar: tabelas legíveis, boa densidade de informação, hierarquia clara, botões com nomes explícitos, contraste, foco visível, navegação por teclado.
- **Evitar:** glassmorphism, gradientes exagerados, animações decorativas, cards gigantes com pouca informação, estética futurista, excesso de sombras e de bordas arredondadas, cara de template genérico.
- Menu **superior** (não usar sidebar permanente).
- Dispositivo prioritário: desktop/notebook. **Tem que funcionar bem em 1366 × 768.**
- Idioma pt-BR, moeda BRL, datas DD/MM/AAAA.

## Regras que não podem ser quebradas

1. **Cores por oficina.** `--primary` e `--secondary` são sobrescritas em tempo de execução pelo `AppShell` com as cores escolhidas em Configurações (a segunda oficina da demo usa verde-azulado). Use sempre os tokens (`bg-primary`, `text-primary`, `bg-primary-soft`, `bg-secondary`…), nunca o azul fixo. `--primary-fg`/`--secondary-fg` são calculadas por contraste.
2. **Gráfico do Financeiro** usa um par fixo azul `#2563EB` / âmbar `#D97706`, validado para daltonismo. Se trocar, revalide.
3. **Sem dados fixos nos componentes.** Tudo vem de `useApp()` (`view` para leitura, `act()` para escrita). Não coloque números ou listas "de enfeite".
4. **Sem regra de negócio na interface.** Lógica fica em `src/services`. Não altere `src/services`, `src/domain` nem `src/demo` em uma tarefa visual.
5. **Estados obrigatórios em toda tela:** carregando, lista vazia, busca sem resultado, erro, sucesso, permissão insuficiente, offline. Já existem — preserve.
6. **Offline e permissões:** botões de escrita usam `disabled={!online}` e somem/desabilitam conforme `can(...)`. Mantenha.
7. **Modais** são `<dialog>` nativos na *top layer*; os toasts usam `popover` para ficar acima deles. `z-index` comum não passa por cima de um modal.
8. **Acessibilidade:** rótulos associados (`Field`), `aria-label` em botões só com ícone, foco visível global em `globals.css`.
9. A barra amarela "Ambiente de demonstração" precisa continuar visível e clara.

## Detalhes técnicos úteis

- `Input`/`Select`/`Textarea` aplicam `w-full` por padrão; passar uma classe `w-*` substitui. **Outras classes conflitantes (altura, padding) não são mescladas** — não há `tailwind-merge`. No cartão do Kanban há um `<select>` nativo por esse motivo. Adotar `tailwind-merge` ou variantes de tamanho seria uma melhoria bem-vinda.
- `html { font-size: 14px }` — a escala `rem` do Tailwind parte de 14 px. Fonte: Segoe UI / fontes do sistema.
- O Kanban limita a altura das colunas com `max-h-[calc(100vh-270px)]`; se a altura do cabeçalho mudar, ajuste.
- A tela de acesso usa a cor primária padrão (ainda não há oficina selecionada).

## Pontos visuais que merecem atenção

Observações de quem construiu; nada disso foi pedido pelo cliente ainda.

- **Cabeçalho:** uma linha com 8 módulos + Nova OS + conexão + sino + usuário fica apertado em 1366 px com nomes longos de oficina.
- **Dashboard:** seis indicadores iguais em linha, sem hierarquia entre eles; "Atividade recente" é uma lista simples.
- **Cartões do Kanban:** compactos, mas o seletor "Mover para…" pesa visualmente em cada cartão.
- **Modal de detalhes da OS:** muitas ações no rodapé (status, cancelar, PDF, editar, pagamento).
- **Nova OS:** formulário em duas colunas; a lista de sugestões de cliente usa posição absoluta com deslocamento fixo (`top-[58px]`).
- **Financeiro:** o gráfico diário fica ralo quando há poucos lançamentos no mês.
- **Agenda:** visão de semana e mês funcionais porém básicas; sem grade de horários.
- **Tabelas:** estilo único `.data-table`; sem ordenação por coluna nem paginação.
- **Estados vazios:** ícone + texto, sem ilustração.
- **Sem tema escuro** e **sem layout para celular** (fora do escopo atual; desktop é a prioridade).
- **Sem favicon/logotipo próprio do GAVYO Auto** — usa um ícone de chave inglesa.

## Como conferir o resultado

Percorra em 1366 × 768, como Proprietário na *Oficina Modelo Passaré*: Início → Ordens (abrir Nova OS e os detalhes de uma OS) → Estoque → Financeiro → Agenda (dia/semana/mês) → Clientes → Relatórios → Configurações. Depois troque para a *Auto Elétrica Castelão* (cores diferentes), para um Mecânico (menu reduzido) e simule queda de conexão na barra de demonstração.
