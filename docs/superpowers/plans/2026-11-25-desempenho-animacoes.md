# Desempenho das animações — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o site mais leve nas animações, medindo antes e depois, **sem tirar nenhuma animação** do catálogo (`docs/ANIMACOES.md`).

**Architecture:** Primeiro um medidor repetível (Playwright + Chrome instalado, CPU 4× mais lenta, build de produção) grava a linha de base. Depois trocamos o *como* de cada animação cara — sombras/fundos/larguras animados viram `transform`/`opacity` em pseudo-elementos, laços `requestAnimationFrame` que forçam React ou layout a cada quadro viram escrita direta no DOM ou observadores, e o vidro (`backdrop-filter`) fica mais barato. Por fim medimos de novo e registramos o ganho.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, CSS em `src/app/globals.css`, Vitest 5, `playwright-core` (novo, só dev, usa o Chrome já instalado).

**Spec:** Pedido do usuário (2026-11-25): "o site está pesado nas animações; deixar mais leve / rodada de medição de desempenho, sem tirar as animações". Achados da auditoria na seção **Achados** abaixo.

## Achados (o que pesa hoje)

| # | Onde | Por que pesa |
|---|---|---|
| 1 | `globals.css` keyframes `card-glow`, `card-land`, `tv-live` (infinita), `tv-fresh`, `tab-got`, `paid-out`, `illus-seq`, `illus-type` | Animam `box-shadow`, `background` ou `width` → repintura (e layout, no caso de `width`) a cada quadro. `tv-live` roda o dia inteiro na TV. |
| 2 | `.count-up` (transition de `box-shadow`/`background-color` 500 ms) + `CountUp` (`setState` a cada quadro) | Cada número que conta re-renderiza o React ~40 vezes em 650 ms; Hoje/Financeiro têm vários ao mesmo tempo. |
| 3 | `.island`, `.movable-nav-frame`, `.side-nav`, `.island-search-slot .order-search` | `backdrop-filter: blur(12–16px) saturate(1.4)` em elementos fixos/sticky: o desfoque é recalculado a cada quadro de rolagem. A busca tem desfoque **dentro** de uma cápsula já desfocada. Fundo já é 90–92% opaco. |
| 4 | `.with-sidebar { transition: padding-left 320ms }` | Relayout da página inteira por 320 ms; a troca já é animada pela View Transition #5. |
| 5 | `.wiz-stepper-dot { transition: all … }` | Anima qualquer propriedade que mudar, inclusive as de layout. |
| 6 | `guided-tour.tsx` laço rAF eterno | `getBoundingClientRect()` a cada quadro enquanto o tour está aberto. |
| 7 | `swoop.tsx` / `.swoop-eagle` | 4 `drop-shadow` no mesmo elemento que gira e anda a cada quadro. |
| 8 | `orders-page.tsx` `OrderCard` sem `memo` | Mover um cartão re-renderiza todos os cartões (doc diz: 65–85 ms, "maior parte é o React"). |

## Global Constraints

- Nenhuma animação do catálogo `docs/ANIMACOES.md` (1 a 10) pode sumir; aparência final de cada uma deve ficar igual a olho nu (mesma cor, mesmo tempo, mesma curva).
- Movimento reduzido continua desligando tudo (`html[data-motion="reduce"]` e `prefers-reduced-motion`).
- Duração das animações continua entre 200 e 720 ms (regra do catálogo); não mudar durações.
- Medir **sempre** com `npm run build && npm run start` (o doc avisa: `npm run dev` é ~4× mais pesado).
- Textos e nomes novos em português, no estilo dos comentários existentes.
- `npm run lint`, `npm run typecheck` e `npm test` passam ao fim de cada tarefa.

## Review Focus

1. **Movimento reduzido:** com `data-motion="reduce"` nenhuma das animações reescritas pode rodar (pseudo-elementos novos incluídos) — teste estático na Tarefa 2.
2. **Leitor de tela no `CountUp`:** o valor final continua no `sr-only` e nunca muda quadro a quadro — teste na Tarefa 4.
3. **Tour com rolagem/redimensionar:** o recorte acompanha o alvo ao rolar a página e ao redimensionar a janela, sem laço eterno — teste na Tarefa 4.
4. **Arrastar cartão** (dnd-kit) continua funcionando com `OrderCard` memorizado (o cartão "fantasma" `overlay` inclusive) — verificação manual na Tarefa 5.
5. **Tema/cor da oficina:** brilhos reescritos continuam usando `var(--primary)`, `var(--c)`, `var(--st)`, `var(--tv-done)` (trocar a oficina muda a cor do brilho) — teste estático na Tarefa 2.

---

## Estrutura de arquivos

- Criar `scripts/medir-animacoes.mjs` — medidor (cenários, CPU 4×, grava JSON).
- Criar `docs/validacao/desempenho-antes.json` e `docs/validacao/desempenho-depois.json` — resultados.
- Criar `tests/animations-css.test.ts` — regras estáticas sobre `globals.css`.
- Criar `tests/count-up.test.ts` e `tests/guided-tour-follow.test.ts`.
- Modificar `src/app/globals.css`, `src/components/ui/count-up.tsx`, `src/components/ui/guided-tour.tsx`, `src/components/ui/swoop.tsx`, `src/features/orders/orders-page.tsx`, `package.json`, `docs/ANIMACOES.md`.

---

### Task 1: Medidor de animações e linha de base

**Files:**
- Create: `scripts/medir-animacoes.mjs`
- Create: `docs/validacao/desempenho-antes.json`
- Modify: `package.json` (devDependency `playwright-core`, script `"medir": "node scripts/medir-animacoes.mjs"`)

**Interfaces:**
- Produces: `npm run medir -- --saida docs/validacao/<arquivo>.json [--url http://localhost:3000]` → grava `{ data, cpu: 4, cenarios: { [nome]: { quadros, p50ms, p95ms, perdidos, loafMs } } }`.

- [ ] **Step 1: Instalar `playwright-core` como devDependency** (`npm i -D playwright-core`). Não baixar navegadores: o script usa `chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" })`, com `--chrome` / variável `CHROME_PATH` para trocar.

- [ ] **Step 2: Escrever o medidor.** Para cada cenário: abre a página em modo demo, aplica `Emulation.setCPUThrottlingRate { rate: 4 }` via CDP, injeta um gravador de quadros (rAF registrando `performance.now()` deltas) e um `PerformanceObserver({ type: "long-animation-frame", buffered: true })`, executa a ação, espera 1,5 s e coleta. `perdidos` = quadros com delta > 33,4 ms; `loafMs` = soma de `blockingDuration`. Cenários (nomes fixos, usados no JSON):
  - `rolagem-servicos` — `/ordens`, rolar a janela até o fim e voltar (`mouse.wheel`, 20 passos).
  - `mover-cartao` — `/ordens`, clicar "Começar" no primeiro cartão de "Esperando" (animação 1).
  - `abrir-servico` — `/ordens`, abrir um cartão (animação 3) e fechar com Esc.
  - `trocar-aba` — clicar nas abas Hoje → Serviços → Financeiro (animação 4a).
  - `numeros-contando` — `/inicio`, receber um pagamento pelo "Quem falta pagar" (animações 2 e 9).
  - `menu-lateral` — fixar o menu na lateral e voltar ao topo (animação 5).
  - `tv-parada` — `/tv`, só gravar 6 s (animação 10, ponto "ao vivo").
  - `tour` — limpar `localStorage`, abrir `/inicio`, gravar 4 s com o tour aberto (animação 6).
  O seletor exato de cada botão o implementador escolhe lendo as telas; se a demo pedir PIN, entrar com o usuário dono da semente (`src/demo/seed.ts`).

- [ ] **Step 3: Rodar a linha de base**

Run: `npm run build` e depois, com `npm run start` rodando em segundo plano, `npm run medir -- --saida docs/validacao/desempenho-antes.json`
Expected: arquivo com os 8 cenários, todos com `quadros > 0`. Colar a tabela (cenário, p95, perdidos) no relatório da tarefa.

- [ ] **Step 4: Commit**

```bash
git add scripts/medir-animacoes.mjs docs/validacao/desempenho-antes.json package.json package-lock.json
git commit -m "chore(desempenho): medidor de animações e linha de base"
```

---

### Task 2: Brilhos e sombras animados só com transform/opacity

**Files:**
- Modify: `src/app/globals.css` (keyframes e regras dos Achados 1, 2 e 5)
- Test: `tests/animations-css.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: regra do projeto, verificada por teste: "keyframe não anima `box-shadow`, `background*`, `width`, `height`, `top`, `left`, `margin`, `padding`".

- [ ] **Step 1: Escrever o teste estático**

```ts
// tests/animations-css.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync("src/app/globals.css", "utf8");
const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map((m) => ({ name: m[1], body: m[2] }));
const CARAS = /(?:^|[{;\s])(box-shadow|background(?:-color)?|width|height|top|left|margin|padding)\s*:/;
// clip-path é usado de propósito nas revelações (troca de oficina, QR); fica de fora.
describe("animações leves", () => {
  it("nenhum keyframe anima propriedade de pintura/layout", () => {
    expect(keyframes.filter((k) => CARAS.test(k.body)).map((k) => k.name)).toEqual([]);
  });
  it("nada usa transition: all", () => {
    expect(css).not.toMatch(/transition:\s*all\b/);
  });
  it(".with-sidebar não anima padding-left (a View Transition já anima)", () => {
    expect(css).not.toMatch(/\.with-sidebar\s*\{[^}]*transition/);
  });
  it("brilhos continuam na cor da oficina/etapa", () => {
    // A regra que roda cada brilho (animation: <nome>) também usa a variável de cor dele.
    const blocks = css.split("}");
    const cor = { "card-glow": "--primary", "tv-live": "--tv-done", "tv-fresh": "--c", "tab-got": "--st" };
    for (const [nome, v] of Object.entries(cor)) {
      expect(blocks.some((b) => new RegExp(`animation:[^;]*\\b${nome}\\b`).test(b) && b.includes(`var(${v}`))).toBe(true);
    }
  });
  it("movimento reduzido desliga os pseudo-elementos de brilho", () => {
    expect(css).toMatch(/data-motion="reduce"\][^{]*::(after|before)[^{]*\{[^}]*animation:\s*none/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/animations-css.test.ts`
Expected: FAIL listando `illus-seq, illus-type, card-land, card-glow, paid-out, tv-live, tv-fresh, tab-got` e o `transition: all`.

- [ ] **Step 3: Reescrever cada um sem mudar a aparência**
  - `card-glow`, `tv-live`, `tv-fresh`, `tab-got`: a sombra vira um `::after` (`position:absolute; inset:0; border-radius:inherit; pointer-events:none; box-shadow:<sombra final>`) e o keyframe anima só `opacity` e `transform: scale()` desse pseudo. `tv-live`: anel de `.7em` = `::after` com `box-shadow: 0 0 0 .7em …` partindo de `scale(.3) opacity 1` até `scale(1) opacity 0`. Se o elemento já usa `::after`, usar `::before`.
  - `card-land`: tirar o `box-shadow` do keyframe; a sombra de "levantado" vai num `::before` com `opacity 1 → 0` na mesma duração.
  - `paid-out`: fundo verde vira `::before` com `background:#bbf7d0` animando `opacity`; a linha mantém `transform`/`opacity`.
  - `illus-seq`: o destaque vira `::before` com fundo `var(--primary)` animando `opacity`; a cor do texto troca com `color` (permitido — não está na lista) ou por um segundo span.
  - `illus-type`: `width` → `clip-path: inset(0 calc(100% - …) 0 0)` com `steps()`, ou `transform: scaleX` num véu por cima; o cursor (borda direita) continua.
  - `.count-up`: tirar `box-shadow`/`background-color` da `transition`; o brilho de subir/descer vira `::after` com `opacity` (mantendo as cores atuais de `data-dir="up"`/`"down"`).
  - `.wiz-stepper-dot`: trocar `all` por `transform, background-color, border-color, color`.
  - `.with-sidebar`: remover a `transition` de `padding-left`.
  - `.side-nav`: acrescentar `contain: layout style` (a largura de `is-open` continua animando, mas sem empurrar o resto).
  - Acrescentar ao bloco de movimento reduzido existente: `html[data-motion="reduce"] *::before, html[data-motion="reduce"] *::after { animation: none !important; }` (e o mesmo dentro de `@media (prefers-reduced-motion: reduce)`), se ainda não houver regra equivalente.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/animations-css.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Conferir a olho** no `npm run build && npm run start`: animações 1, 2, 9, 10 e o tour lado a lado com `git stash` da versão anterior (captura no meio de cada uma, como em `docs/ANIMACOES.md` › Testes). Mesma cor e mesmo tempo.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css tests/animations-css.test.ts
git commit -m "perf(animações): brilhos e sombras só com transform e opacity"
```

---

### Task 3: Vidro mais barato

**Files:**
- Modify: `src/app/globals.css` (linhas de `.island`, `.island-search-slot .order-search`, `.side-nav`)
- Test: `tests/animations-css.test.ts` (acrescentar)

- [ ] **Step 1: Acrescentar o teste**

```ts
it("vidro: desfoque até 8px, sem saturate, e nunca vidro dentro de vidro", () => {
  const blurs = [...css.matchAll(/(?<!-webkit-)backdrop-filter:\s*([^;]+);/g)].map((m) => m[1]);
  for (const b of blurs) {
    expect(Number(/blur\((\d+)px\)/.exec(b)?.[1] ?? 0)).toBeLessThanOrEqual(8);
    expect(b).not.toMatch(/saturate/);
  }
  expect(css).not.toMatch(/\.island-search-slot \.order-search\s*\{[^}]*backdrop-filter/);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/animations-css.test.ts` → FAIL (14px/16px, saturate, busca com vidro).

- [ ] **Step 3: Ajustar:** `blur(8px)` sem `saturate` em `.island`/`.movable-nav-frame` e `.side-nav` (manter o par `-webkit-`); remover `backdrop-filter` da busca dentro da ilha e subir o fundo dela para `color-mix(in srgb, var(--surface) 96%, transparent)`. Fundos das cápsulas ficam como estão (90–92%) — a leitura continua garantida.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS. Conferir a olho a ilha rolando sobre cartões coloridos, claro e escuro.

- [ ] **Step 5: Commit** — `git commit -am "perf(animações): vidro da ilha e do menu mais barato"`

---

### Task 4: Laços de quadro que não acordam o React nem o layout

**Files:**
- Modify: `src/components/ui/count-up.tsx`, `src/components/ui/guided-tour.tsx`, `src/components/ui/swoop.tsx`, `src/app/globals.css` (`.swoop-eagle`)
- Test: `tests/count-up.test.ts`, `tests/guided-tour-follow.test.ts`

**Interfaces:**
- Produces: `export function followBox(el: Element, onChange: (r: DOMRect) => void): () => void` em `src/components/ui/guided-tour.tsx` (exportado para teste) — chama `onChange` na hora, depois só quando houver `scroll` (captura, passivo), `resize` ou `ResizeObserver` no alvo, no máximo 1× por quadro; devolve a função que desliga tudo.
- Produces: `export function countFrames(start: number, end: number, duration: number, format: (n: number) => string): (now: number) => { text: string; done: boolean }` em `src/components/ui/count-up.tsx` — passo puro do contador (saída cúbica atual).

- [ ] **Step 1: Escrever os testes** (ambiente `node`, sem DOM: testar só as partes puras e o desligamento)

```ts
// tests/count-up.test.ts
import { countFrames } from "@/components/ui/count-up";
it("conta com saída cúbica e termina exatamente no valor final", () => {
  const step = countFrames(0, 100, 650, String);
  expect(step(0)).toEqual({ text: "0", done: false });
  expect(step(325).text).toBe("88"); // 1-(0.5)^3 = 0.875 → 88 (arredondado)
  expect(step(650)).toEqual({ text: "100", done: true });
  expect(step(9999)).toEqual({ text: "100", done: true });
});
```

```ts
// tests/guided-tour-follow.test.ts — com stubs mínimos de window/ResizeObserver/requestAnimationFrame
it("followBox avisa na hora, junta eventos no mesmo quadro e desliga tudo", () => { /* 
  1) chama onChange 1× ao ligar;
  2) dispara 3 'scroll' antes do próximo rAF → onChange chamado só +1 vez;
  3) depois de off(): 'scroll'/'resize' não chamam mais e o ResizeObserver foi desconectado. */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/count-up.test.ts tests/guided-tour-follow.test.ts` → FAIL (funções não exportadas).

- [ ] **Step 3: Implementar**
  - `CountUp`: o laço usa `countFrames` e escreve `textContent` num `ref` do `<span aria-hidden>`; `setState` só para `dir` (início e fim). O `sr-only` continua renderizando `format(value)` pelo React. Primeira exibição e movimento reduzido: sem laço.
  - `GuidedTour`: trocar o laço rAF eterno por `followBox(el, r => setBox(...))`, mantendo a comparação que evita `setBox` igual.
  - `Swoop`: envolver o `<img>` do gavião num wrapper que recebe o `transform` e o `will-change: transform`; o `filter` com as 4 sombras fica na `<img>` de dentro (rasterizada uma vez na camada). Classes: wrapper `.swoop-eagle`, imagem `.swoop-eagle-img`.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS; `npm test` inteiro → PASS.

- [ ] **Step 5: Commit** — `git commit -am "perf(animações): contador, tour e gavião sem trabalho a cada quadro"`

---

### Task 5: Mover cartão sem re-renderizar o quadro inteiro

**Files:**
- Modify: `src/features/orders/orders-page.tsx` (`OrderCard`, linha 53, e quem o renderiza)

- [ ] **Step 1: Medir só o cenário** — `npm run medir -- --saida %TEMP%/mover.json` com o build atual; anotar p95 de `mover-cartao`.

- [ ] **Step 2: Memorizar** — `const OrderCard = memo(function OrderCard(...))`; as props hoje são `order`, `draggable`, `overlay` (valores estáveis se `order` mantém a identidade). Se o cartão ler o contexto do app (`useApp()`), passar a ler só o que precisa por props vindas do pai, para o `memo` valer; callbacks criados no pai vão para `useCallback`. Não usar `memo` com comparador customizado.

- [ ] **Step 3: Conferir que funciona** — `npm run build && npm run start`: arrastar cartão entre colunas (o "fantasma" acompanha), Começar, Marcar como pronto, Mover para; o brilho `.just-moved` e o "Novo" (`.just-born`) continuam aparecendo.

- [ ] **Step 4: Medir de novo** — p95 de `mover-cartao` menor que no Step 1. Se não melhorou, desfazer a tarefa e anotar no relatório (não seguir para outra abordagem sem perguntar).

- [ ] **Step 5: Commit** — `git commit -am "perf(serviços): cartão memorizado ao mover"`

---

### Task 6: Medir de novo e registrar

**Files:**
- Create: `docs/validacao/desempenho-depois.json`
- Modify: `docs/ANIMACOES.md` (seção "Desempenho")

- [ ] **Step 1: Medir** — `npm run build`, `npm run start`, `npm run medir -- --saida docs/validacao/desempenho-depois.json`.
Expected: em todo cenário, `perdidos` e `p95ms` **menores ou iguais** aos de `desempenho-antes.json`; nenhum cenário pior em mais de 5% (ruído). Se algum piorou, voltar à tarefa responsável.

- [ ] **Step 2: Atualizar `docs/ANIMACOES.md` › Desempenho** com a tabela antes/depois (cenário, p95, perdidos), como rodar `npm run medir`, e as regras novas: keyframes só com `transform`/`opacity` (teste `tests/animations-css.test.ts`), vidro até 8px sem vidro dentro de vidro, laço de quadro não chama `setState`.

- [ ] **Step 3: Commit**

```bash
git add docs/validacao/desempenho-depois.json docs/ANIMACOES.md
git commit -m "docs(desempenho): medição antes e depois das animações"
```
