# Navegação móvel

A barra inteira pode ser arrastada em qualquer direção pela alça de pontos, sempre disponível. Um deslocamento mínimo de 6px evita movimento por clique acidental. Ao sair do topo, a barra flutua em formato vertical compacto; o menu de três pontos alterna horizontal/vertical e oferece posições à esquerda/direita ou retorno ao topo. Ao flutuar, não reserva uma faixa vazia na página.

O botão Organizar foi retirado. Reordenar atalhos e restaurar a ordem ficam no menu discreto; os controles de edição só aparecem quando essa opção é escolhida. Links normais continuam sendo links; a alça move a barra sem abrir um módulo.

Alternativas: setas do teclado sobre a alça movem 24px; Escape cancela o arraste. As posições predefinidas do menu oferecem alternativa com clique/toque. Ponteiro capturado durante o gesto permite soltar fora da alça.

Preferências locais por usuário e oficina: ordem em gavyo:navigation:v1:<oficina>:<usuario>, posição/orientação em gavyo:navigation-position:v1:<oficina>:<usuario>. Sem sincronização entre navegadores. Posição inválida é ignorada e coordenadas são limitadas à viewport, inclusive após redimensionar. Permissões e módulos ativos continuam filtrados antes da renderização.

Implementação: personal-navigation.tsx mantém os atalhos e movable-navigation.tsx fornece posicionamento/menu. Esta extensão substitui a antiga seção de navegação superior do DESIGN.md; os demais tokens e componentes foram preservados.

Referências de comportamento: [SketchUp Toolbars](https://help.sketchup.com/en/sketchup/toolbars) e [Qt floating dock widgets](https://doc.qt.io/qt-6/qdockwidget.html). A barra usa a identidade própria do GAVYO, sem reproduzir marcas externas.

Verificação: typecheck, lint, 32 testes e build aprovados. Arraste diagonal do topo para (122,269), seguido de movimento para cima/direita até (776,179); reload preservou a posição. Movimento por seta, troca de orientação, posicionamento à esquerda e retorno ao topo exercitados. Desktop1366×768 e mobile390×844 conferidos; no mobile, bounds(8,160,240,616), documento380px, sem overflow da página. Capturas em outputs/gavyo-redesign no workspace de entrega. Sem mudanças em serviços, domínio ou demo.
