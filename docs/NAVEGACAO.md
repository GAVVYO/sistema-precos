# Navegação — 17/11/2026

Substitui a descrição anterior (barra só com arraste/encaixe no topo). Guia de uso completo em [INTERFACE.md](INTERFACE.md); animações em [ANIMACOES.md](ANIMACOES.md).

## Três posições do menu

| Posição | Quando vale | Como entrar | Como sair |
|---|---|---|---|
| **Topo** (padrão) | Sempre | — | — |
| **Lateral** | A partir de 1100 px | Arrastar a alça ⋮⋮ até a borda esquerda (aparece "Solte para fixar na lateral"); **Minha conta › Menu na lateral**; alça › **Fixar na lateral** | **Menu no topo** (rodapé da barra); arrastar a alça da barra até o topo ("Solte para voltar o menu ao topo"); Minha conta; tecla Home/↑ na alça |
| **Flutuante** | Telas largas | Arrastar a alça para o meio da tela; alça › Flutuar à esquerda/direita | Arrastar até o topo; alça › Encaixar no topo; Home |

- **Topo**: duas linhas — oficina, busca e ações; abaixo, abas sempre com nome (8 / 6 / 4 + "Mais" pela largura, a tela atual nunca vai para o "Mais"), com pílula deslizante.
- **Lateral**: barra fixa à esquerda que empurra a página (o cabeçalho vira uma linha: busca + ações). Recolhida (108 px, ícone com nome curto: "Clientes", "Ajustes") e aberta com o mouse por cima (240 px, por cima do conteúdo; atrasos de 120/220 ms); foco do teclado abre. Nome acessível dos itens curtos inclui o nome completo ("Ajustes — Configurações").
- **Celular** (< 768 px): abas numa barra flutuante embaixo, com ícone e nome; topo e lateral não se aplicam.
- Posição, modo e ordem são salvos por usuário e oficina neste navegador (`gavyo:navigation-position:v1`, `gavyo:navigation-mode:v1`).

## Teclado e alternativas ao arraste (WCAG 2.5.7)

- Alça do menu: clique abre **Posicionar navegação** (topo, lateral, flutuar, mover em passos); setas movem; Home volta ao topo; Esc cancela o arraste.
- Toda posição tem caminho por botão (Minha conta, Posicionar navegação, Menu no topo).
- `scroll-padding-top` acompanha a altura do cabeçalho (140 px topo, 84 px lateral, 196 px tablet, 124 px celular) para o foco não ficar escondido (WCAG 2.4.11).

## Arquivos

`src/components/layout/movable-navigation.tsx` (arraste, alvos topo/lateral, Posicionar navegação), `personal-navigation.tsx` (abas, "Mais", pílula), `side-navigation.tsx` (barra lateral, modo, transição), `nav-pill.tsx`, `app-shell.tsx` (cabeçalho e layout).
