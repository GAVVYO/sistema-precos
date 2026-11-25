# Animações — catálogo e como fazer novas

Princípio: **a animação mostra o que aconteceu**, não enfeita. O estado já mudou quando ela começa; nada espera a animação para funcionar. Duração entre 200 e 720 ms. **Movimento reduzido** (do sistema ou em Acessibilidade) desliga tudo: a mudança acontece direto.

Referências: View Transitions do Safari 18/Arc/Linear, Liquid Glass (macOS Tahoe/iOS 26), coach marks do Material/iOS Tips; Impeccable *animate* e *onboard*.

## Catálogo

| # | Animação | Quando | Como | Arquivos |
|---|---|---|---|---|
| 1 | **Cartão anda de coluna** | Começar / Marcar como pronto / ⋯ Mover para | View Transition `move`: cada cartão tem `--vt: card-<id>`; o que mudou voa (560 ms, leve exagero), assenta (`card-land`) e brilha (`.just-moved`, 1,1 s). No arraste não anima. | `src/features/orders/move-order.ts`, `orders-page.tsx` |
| 2 | **Receber com comemoração** | Recebi R$ … | View Transition `pay`: linha de "Quem falta pagar" sai com brilho verde (`paid-out`) e as outras sobem. Em paralelo, `celebratePayment`: check que se desenha, 12 moedas, "+ R$ …" voa até a aba Financeiro (ou Hoje), que dá um pulinho. | `src/lib/celebrate.ts`, `order-dialogs.tsx`, `today-panel.tsx` |
| 3 | **Cartão vira a janela** | Ver serviço completo / abrir serviço | View Transition `open`/`close`: o cartão (`.vt-hero`) e a janela (`.order-hero-dialog`) compartilham o nome `order-hero`. Sem cartão na tela, nasce do botão clicado. | `src/app-state/app-context.tsx` (`openOrder`) |
| 4a | **Pílula da aba desliza** | Trocar de aba | CSS: `NavPill` mede o link ativo e move com `transform` (420 ms, exagero leve). Não anima na primeira medida. | `src/components/layout/nav-pill.tsx` |
| 4b | **Cor da oficina varre a tela** | Trocar oficina na barra da demo | View Transition `workshop`: a página nova aparece num círculo crescendo a partir da logo (`--vt-x/--vt-y`, 720 ms). Tema aplicado em `useLayoutEffect` para entrar na foto nova. | `app-shell.tsx` (DemoBar) |
| 5 | **Logo voa para o menu lateral e estoura** | Fixar menu na lateral / voltar ao topo | View Transition (`data-nav-switch`): logo, nome, busca, ferramentas, conteúdo e barra da demo com nomes próprios; barra lateral desliza (`vt-side-in`); itens em cascata; anel + 8 partículas (`.side-burst`). | `src/components/layout/side-navigation.tsx` |
| 6 | **Tour de primeira vez** | 1ª visita a Hoje, Serviços e painel | Recorte com pulso, seta que pula, balão que surge, ilustrações (placa digitando, sequência de botões, cartão arrastado, toque). Espera a rolagem e nenhuma janela aberta. | `src/components/ui/guided-tour.tsx` |
| 7 | **Desenho da forma de pagamento** | Escolher a forma em Receber | CSS: cartão gira (`pay-card-in`) com brilho; cédulas em leque; celular sobe com check; comprovante "imprime". | `src/features/orders/payment-stage.tsx` |

| 8 | **Serviço novo nasce no quadro** | Depois de abrir um serviço, quando o cartão aparece (ao fechar a janela ou abrir Serviços) | `markBorn` ao criar; o cartão escuta `gavyo:order-closed` e, sem janela aberta, ganha `.just-born` (pop 620 ms + anel + selo "Novo"). Uma vez, até 2 min. | `src/lib/born.ts`, `orders-page.tsx`, `app-context.tsx` |
| 9 | **Números que contam** | Valor muda (Hoje, Financeiro, Estoque, colunas, Quem falta pagar, TV) | `CountUp`: rAF com saída cúbica (650 ms), brilho verde ao subir e na cor da oficina ao descer; só em mudanças; leitor de tela recebe o valor final. `Stat` e `MetricCard` animam qualquer valor numérico (`format` para reais). | `src/components/ui/count-up.tsx` |
| 10 | **TV: chegada e mudança de etapa** | Carro novo ou que mudou de etapa | Cartões entram em cascata a cada página; o que mudou pulsa 3× na cor da etapa; ponto "ao vivo" pulsando. | `src/features/tv/tv-page.tsx` |

Todas as regras CSS estão em `src/app/globals.css`, nos blocos "Menu na lateral", "Animações que mostram o que aconteceu", "Tour guiado" e "Janela Receber".

## Receita para uma nova transição

```ts
import { withTransition, vtName } from "@/lib/view-transition";

withTransition("meu-tipo", () => {
  act((db, ctx) => algumServico(db, ctx, ...)); // a mudança de verdade
}, {
  before: () => { /* marcar o elemento de origem (classe) */ },
  done: () => { /* limpar classes / efeitos depois */ },
  vars: { "--vt-x": "120px" }, // variáveis CSS só durante a troca
});
```

```css
/* Nomes só existem durante a troca: nunca há nome repetido fora dela. */
html[data-vt="meu-tipo"] .meu-item { view-transition-name: var(--vt); view-transition-class: meu-item; }
::view-transition-group(.meu-item) { animation-duration: 420ms; animation-timing-function: cubic-bezier(.16,1,.3,1); }
```

Regras aprendidas:

1. **Nome único**: dois elementos com o mesmo `view-transition-name` na mesma foto cancelam a transição. Por isso os nomes vêm de `var(--vt)` e só valem com `html[data-vt=…]`.
2. **Não use `requestAnimationFrame` dentro da transição**: o navegador não desenha quadros nela e a troca expira ("DOM update timed out"). `withTransition` espera a fila de tarefas (`setTimeout 0`), suficiente para efeitos do React e `showModal()`.
3. **Sem "fantasma"**: para elementos que só mudam de lugar/tamanho, esconda a foto antiga e use `object-fit: cover; object-position: left top` na nova (ver `main-content`).
4. **`::view-transition-old(root)`** está oculto por padrão; transições que precisam da página antiga visível (troca de oficina, abrir janela) o reativam com `display: block`.
5. **Arraste não anima** (o item já está na mão da pessoa).
6. **Fallback**: sem suporte (Firefox antigo) ou com movimento reduzido, `withTransition` só executa a mudança.
7. **Acessibilidade**: animação nunca é a única informação — o aviso escrito (toast) continua.

## Desempenho

**`npm run dev` é ~4× mais pesado** — para julgar fluidez use `npm run build && npm run start`. Regra: só dê nome de transição ao que realmente muda de lugar (ex.: colunas marcadas com `data-vt-col`).

### Como medir

```bash
npm run build && npm run start          # em outro terminal
npm run medir -- --janela --saida docs/validacao/desempenho/<nome>.json
```

`scripts/medir-animacoes.mjs` abre o Chrome instalado, deixa a CPU 4× mais lenta, roda 8 cenários (rolagem em Serviços, mover cartão, abrir serviço, trocar aba, números contando, menu lateral, TV parada, tour) e grava a **mediana de 3 rodadas**: quadros, p95 do intervalo entre quadros, quadros perdidos (> 33 ms) e tempo de quadros longos (LoAF). `--so <cenário>` roda um só; `--vezes N` muda as rodadas. A medição tem ruído grande entre momentos diferentes: **compare sempre antes e depois lado a lado, alternando** (dois servidores, portas diferentes).

### Rodada de 25/11/2026 (antes × depois, alternados, 2× cada)

| Cenário | p95 antes | p95 depois | perdidos antes | perdidos depois | quadros longos antes (ms) | depois (ms) |
|---|---|---|---|---|---|---|
| rolagem-servicos | 16,8 / 16,8 | 16,8 / 16,8 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| mover-cartao | 33,4 / 33,4 | 33,6 / 33,3 | 3 / 3 | 5 / 4 | 271 / 261 | 425 / 315 |
| abrir-servico | 166,6 / 66,8 | 66,6 / 83,3 | 15 / 12 | 13 / 11 | 1657 / 855 | 1089 / 978 |
| trocar-aba | 50 / 50 | 50 / 50 | 12 / 14 | 16 / 13 | 492 / 597 | 542 / 407 |
| numeros-contando | 33,2 / 16,9 | 33,3 / 16,8 | 3 / 2 | 2 / 2 | 688 / 531 | 515 / 447 |
| menu-lateral | 150,1 / 66,7 | 66,6 / 66,6 | 18 / 17 | 21 / 18 | 1378 / 560 | 430 / 352 |
| tv-parada | 16,8 / 16,8 | 16,8 / 16,8 | 3 / 1 | 2 / 0 | 81 / 0 | 41 / 0 |
| tour | 16,8 / 16,8 | 16,8 / 16,8 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

Arquivos: `docs/validacao/desempenho/antes-*.json` e `depois-*.json`.

Leitura: a diferença ficou **dentro do ruído** na maioria dos cenários. O que trava quadros hoje é o trabalho do React (abrir serviço, menu lateral, trocar aba, mover cartão), não a pintura das animações. As mudanças desta rodada tiram trabalho da **pintura** e do **React por quadro**, que este medidor (baseado em `requestAnimationFrame`) quase não enxerga: sombras e fundos animados viraram `transform`/`opacity`, o "ao vivo" da TV (o dia inteiro) não repinta mais, o contador não re-renderiza o React ~40× e o tour não mede a tela a cada quadro.

Próximo passo para ganho visível: o `OrderCard` e outras telas leem o contexto inteiro do app (`useApp()`), então qualquer mudança redesenha tudo; dividir esse contexto é o que reduziria os quadros longos.

### Regras (com teste em `tests/animations-css.test.ts`)

- Keyframe só anima `transform`, `opacity` (e `filter`/`clip-path` em casos pontuais) — nunca `box-shadow`, `background`, `width`, `height`, `top`, `left`, `margin`, `padding`. Brilho/sombra: deixe pronto num `::before`/`::after` e anime a opacidade.
- Nada de `transition: all`.
- Vidro (`backdrop-filter`) desligado no cabeçalho e no menu (bloco "Leveza"); se voltar, no máximo `blur(8px)`, sem `saturate`, nunca vidro dentro de vidro.
- Laço de quadro (`requestAnimationFrame`) não chama `setState`: escreve direto no elemento (ver `CountUp`) ou mede só em evento (ver `src/lib/follow-box.ts`).

## Testes

Roteiros Playwright usados (fora do repositório, recriáveis a partir de `docs/validacao/simular-sem-treino.js`): capturas no meio de cada animação, contagem de transições com `reducedMotion: 'reduce'` (deve ser 0) e axe nas telas com menu lateral e janela Receber.
