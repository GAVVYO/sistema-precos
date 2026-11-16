---
name: GAVYO Auto
description: Atendimento de oficina com leitura direta, estados funcionais e ação junto à OS.
colors:
  primary: "#2563eb"
  primary-fg: "#ffffff"
  primary-hover: "color-mix(in srgb, var(--primary) 84%, black)"
  primary-soft: "color-mix(in srgb, var(--primary) 9%, white)"
  secondary: "#172033"
  secondary-fg: "#ffffff"
  bg: "#f2f4f7"
  surface: "#ffffff"
  text: "#172033"
  muted: "#536379"
  border: "#dee5ed"
  success: "#15803d"
  success-soft: "#e8f5ec"
  warning: "#b45309"
  warning-soft: "#fdf3e1"
  danger: "#b91c1c"
  danger-soft: "#fdecec"
  table-header: "#f8fafc"
  slate-50: "oklch(98.4% 0.003 247.858)"
  slate-100: "oklch(96.8% 0.007 247.896)"
  slate-700: "oklch(37.2% 0.044 257.287)"
typography:
  display:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "34px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 750
    lineHeight: "20px"
  body:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  table:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  metadata:
    fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "12px"
    lineHeight: "16px"
  plate:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.035em"
rounded:
  plate: "4px"
  filter: "6px"
  button: "7px"
  md: "8px"
  order: "10px"
  panel: "12px"
  pill: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  navigation-active:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "14px 12px"
  status-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
  metric-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.panel}"
    padding: "20px 22px 18px"
  search-result:
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: GAVYO Auto

## Overview

**Creative North Star: "Balcão de serviços"**

Uma área de trabalho clara para a recepção da oficina. Manrope, superfícies frias, cabeçalho escuro e cartões sólidos dão identidade sem competir com o serviço. Número da OS, placa, situação e próxima ação são âncoras recorrentes de leitura.

A aparência é profissional e objetiva: áreas agrupadas por bordas, texto direto em pt-BR e cor com significado operacional. O usuário rejeitou texto pequeno, excesso de informação e animações demoradas. A implementação atual é a fonte deste registro; a revisão independente e a avaliação final do usuário permanecem pendentes.

**Key Characteristics:**
- Cards sólidos e cores vinculadas à função.
- Manrope local e números tabulares nas leituras operacionais.
- Menu superior com busca global acessível por teclado.
- Estado e próxima ação próximos à OS.
- Feedback curto, com suporte a movimento reduzido.

Extraído de `src/app/globals.css`, `src/app/layout.tsx`, `src/components/layout/app-shell.tsx`, dos componentes compartilhados e de amostras de atendimento, ordens e agenda. Capturas desktop e mobile da primeira implementação foram conferidas; a recaptura após os ajustes de legibilidade permanece com a revisão independente. Os tokens descrevem os fontes atuais e seus valores efetivos após a cascata CSS, sem transformar regras antigas sobrescritas em normas.

## Colors

A paleta combina base fria clara, grafite estrutural e cores operacionais sólidas.

### Primary
- **Azul de execução** (`primary`): ação principal, OS clicável, seleção, foco, etapa em andamento e card correspondente.
- **Contraste da ação** (`primary-fg`): texto e ícones sobre a cor principal.
- **Execução escurecida** (`primary-hover`): resposta do botão principal ao ponteiro.
- **Seleção suave** (`primary-soft`): filtros ativos, estados informativos, linhas com foco e resultados da busca sob interação.

### Secondary
- **Grafite de estrutura** (`secondary`): cabeçalho, login e indicador sólido neutro.
- **Contraste de estrutura** (`secondary-fg`): marca, busca em repouso e controles sobre o cabeçalho.

### Tertiary
- **Verde de conclusão** (`success`, `success-soft`): serviço concluído, pagamento recebido e confirmações.
- **Âmbar de espera** (`warning`, `warning-soft`): fila, pendência e atenção operacional.
- **Vermelho de intervenção** (`danger`, `danger-soft`): cancelamento, erro, ação destrutiva e estoque zerado.

### Neutral
- **Fundo frio** (`bg`): área externa aos painéis.
- **Superfície branca** (`surface`): formulários, listas, cards e diálogos.
- **Tinta grafite** (`text`): conteúdo principal.
- **Texto de apoio** (`muted`): descrição, responsável, data e metadados.
- **Linha fria** (`border`): divisores e contornos discretos.
- **Cabeçalho de tabela** (`table-header`): faixa de identificação das colunas.
- **Neutros auxiliares** (`slate-50`, `slate-100`, `slate-700`): hover secundário, chip neutro e áreas de apoio. Os valores OKLCH conservam a fonte Tailwind.

Os valores do frontmatter são os padrões CSS. A oficina ativa substitui `primary` e `secondary` em tempo de execução; `contrastOn` escolhe preto ou branco para os respectivos textos. Misturas de hover e seleção acompanham a cor ativa. Verde, âmbar e vermelho mantêm sua função. Não fixar o azul padrão nos componentes personalizáveis.

**The Functional Color Rule.** A cor reforça uma situação escrita; nenhum estado depende apenas da cor.

**The Workshop Color Rule.** Ação e estrutura usam os tokens da oficina, inclusive seus contrastes calculados.

## Typography

**Display Font:** Manrope Variable, com Segoe UI e fontes do sistema como fallback.
**Body Font:** Manrope Variable, na mesma família.
**Label/Mono Font:** monoespaçada somente na placa.

A fonte variável é importada localmente de `@fontsource-variable/manrope`. Pesos marcados e espaçamento ligeiramente fechado nos títulos criam hierarquia; o conteúdo usa leitura regular. Não há fonte de exibição do sistema como identidade principal.

### Hierarchy
- **Display**: valor destacado dos cards sólidos; usa `display`, com números tabulares.
- **Headline**: título da página; usa `headline`, reduzido para (24px) no mobile.
- **Title**: título dos painéis; usa `title`. Títulos de diálogo são (18px).
- **Body**: conteúdo e controles; usa `body`. Os campos e botões usam entrelinha de (20px), proveniente da escala `text-sm`.
- **Table**: dados tabulares e busca global; usa `table`.
- **Label**: badges, rótulos de campo e filtros; usa `label`. Rótulos de campo e métrica têm peso (500); a métrica usa entrelinha (1.4), e filtros têm peso (650).
- **Metadata**: datas, responsável, dicas e conteúdo auxiliar; usa `metadata` quando a implementação define `text-xs`.
- **Plate**: placa veicular compacta; usa `plate`, com letras preservadas e sem quebra.

Controles de atendimento, rótulos principais, tabela, busca e placa usam agora (14px). Os tamanhos auxiliares registram o código atual e não estabelecem um mínimo de legibilidade. Há notas de métrica e nome da oficina de (11px) no mobile e atalho de (10px); esses casos exigem atenção na revisão, dada a rejeição expressa do usuário a texto pequeno.

**The Readable Action Rule.** Ações usam verbos escritos; ícones SVG acompanham o rótulo ou recebem nome acessível quando o controle é somente um ícone.

## Layout

O contêiner principal e a navegação têm largura máxima de (1600px). No desktop, o conteúdo usa margens internas horizontais de (24px) e topo de (20px). O cabeçalho tem altura mínima de (64px); busca, marca e controles ficam na mesma faixa. A busca ocupa até (470px), limitada a (38vw), antes dos ajustes responsivos.

A escala de espaçamento segue passos de (4px), com intervalos recorrentes de (12px), (16px), (20px) e (24px). Separação de módulos e painéis usa espaço e borda; cada bloco tem um título funcional.

No breakpoint `xl` do Tailwind (80rem), as métricas de atendimento passam de duas para quatro colunas; a área principal admite coluna secundária de (340px). O quadro de ordens tem três colunas, e a semana da agenda preserva sete colunas com rolagem horizontal e largura mínima de (150px) por dia.

Até (1150px), o cabeçalho reduz intervalos, a busca se torna flexível e o status textual de conexão sai dessa faixa. Até (767px), o cabeçalho vira uma grade de duas colunas com busca em uma linha inteira; conteúdo recebe margens internas de (16px), métricas continuam em duas colunas e navegação superior rola horizontalmente. A tabela de serviços vira uma lista de blocos com ação e situação à direita. O quadro de ordens vira uma coluna; agenda semanal mantém rolagem. Diálogos usam quase toda a tela, com folga externa de (8px) e conteúdo rolável. A escolha de pagamento preserva duas colunas em todas as larguras; quatro opções ocupam duas linhas.

## Elevation & Depth

Cards e botões ficam planos em repouso, separados por fundo e borda. A profundidade sinaliza sobreposição ou interação: busca e diálogos flutuam acima do trabalho; cards de OS recebem sombra apenas sob hover ou foco interno.

### Shadow Vocabulary
- **Resultado de busca** (`0 12px 36px rgb(18 32 53 / 20%)`): sobreposição da busca global.
- **Diálogo** (`0 24px 60px rgb(18 32 53 / 22%)`): tarefa modal com fundo escurecido.
- **OS sob interação** (`0 5px 12px rgb(23 32 51 / 6%)`): resposta do card de ordem.
- **Foco do campo** (`0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent)`): halo de foco, acompanhado de contorno visível.

O contorno global de foco usa (2px), afastado (2px); métricas selecionáveis afastam o contorno (4px). O backdrop do diálogo usa `rgb(15 23 42 / 0.45)`.

**The Flat Surface Rule.** Painéis de conteúdo permanecem planos; sombra distingue sobreposição ou resposta à interação.

## Shapes

Painéis, métricas, resultados de busca e diálogos compartilham cantos suaves. O raio de painel é `panel`; cards de OS usam `order`, campos e busca usam `md`, botões usam `button`, e filtros usam `filter`. Placas têm raio `plate`, borda fina e proporção de etiqueta técnica. Status usam cápsulas; pontos circulares acompanham etapas do quadro. A navegação ativa conserva cantos retos e marca a base.

As bordas regulares têm (1px). Não há textura, gradiente ou sombra rígida deslocada no sistema observado.

## Components

### Buttons

Botões são compactos, explícitos e de cor funcional. O tamanho regular tem altura (40px), margem interna horizontal (16px), texto (14px), peso (600) e raio `button`. O tamanho pequeno tem altura (36px), margem interna horizontal (12px) e texto (14px). No cabeçalho, a altura efetiva é (38px), com texto de (14px) no desktop e no mobile.

- **Primary:** preenchimento principal e contraste da oficina; hover escurece a cor.
- **Secondary:** branco com contorno neutro; hover usa neutro muito claro.
- **Ghost:** transparente; hover usa neutro claro.
- **Danger:** branco, texto vermelho e contorno vermelho translúcido; hover usa fundo de erro suave.
- **States:** desabilitado reduz opacidade para (50%); carregamento mostra spinner e desabilita a ação. Pressionar escala para (.98); foco mantém o contorno visível.

### Chips

Badges unem fundo suave, texto semântico de (14px) e cápsula, com margem interna de (4px 10px). A situação é sempre escrita. Filtros são botões com `aria-pressed`, texto de (14px) e margem interna de (8px 10px); seleção usa fundo principal suave. O controle segmentado usa botões de (36px) e texto de (14px). Os chips da agenda são blocos clicáveis com horário e cliente, resposta curta ao ponteiro e conteúdo conforme o modo de exibição.

### Cards / Containers

Cards comuns são brancos, contornados e sem sombra. Cabeçalhos têm margem interna horizontal de (20px) e vertical de (12px); o conteúdo define seu próprio respiro. A tabela usa células com margem interna de (14px 16px) e cabeçalhos de (12px 16px). Linhas sob foco interno recebem seleção suave.

Cards de OS usam margem interna de (16px), número da OS destacado, placa, serviço e responsável. Estado, detalhes e próxima ação permanecem próximos ao registro. Movimento de arrastar e controles de status continuam sujeitos às regras existentes.

### Inputs / Fields

Campos têm fundo branco, contorno neutro e altura regular de (40px), com mínimo CSS de (38px). Hover reforça a borda; foco usa cor principal, halo suave e contorno. Erro é indicado por borda vermelha e mensagem vinculada ao campo. Desabilitado usa fundo neutro claro. Textareas têm altura mínima de (72px). Rótulos ficam associados ao controle.

### Navigation

O menu é superior, em faixa branca abaixo do cabeçalho de estrutura. Itens têm ícone SVG e rótulo, texto de (14px), peso (600) e margem interna de (14px 12px). A página ativa usa texto e borda inferior principais, acrescidos de uma marca de base de (3px). Hover usa neutro claro. A faixa permite rolagem horizontal quando os módulos visíveis excedem a largura. No mobile, mantém texto de (14px), com margem interna de (12px 10px).

### Metrics

Os indicadores sólidos usam `metric-active` e as variantes de espera, conclusão e neutra. Altura mínima de (146px), valor destacado, ícone SVG discreto e nota sobre fundo preto translúcido. No mobile, a margem interna cai para (16px). Quando selecionáveis, funcionam como filtros com `aria-pressed` e feedback de deslocamento de (-2px) no hover. Cada valor vem dos registros atuais; este documento não fixa quantidades nem sugere evolução comercial.

### Global search and next action

A busca permanece no cabeçalho e abre com Ctrl/Cmd+K, foco no campo ou digitação. Busca placa, cliente e OS. Em repouso, usa fundo translúcido sobre a estrutura; sob foco, torna-se branca. O painel mostra até seis registros, com número e placa de um lado, situação e próxima ação do outro. Hover ou foco interno realçam o resultado. Escape e interação externa fecham o painel.

Iniciar, Concluir e Receber usam o mesmo botão principal pequeno nos resultados, na lista e no quadro. A ação disponível depende do estado, da permissão e da conexão; Receber abre o fluxo de pagamento. A assinatura visual aproxima a próxima ação do serviço sem eliminar confirmação ou informação obrigatória.

A forma de pagamento usa botões nativos em grupo identificado, com `aria-pressed`, contorno e fundo principal suave na seleção. As opções têm altura mínima de (44px), texto de (14px) e rótulos escritos.

### Motion

A entrada de página usa deslocamento de (4px) e duração de (180ms), com `cubic-bezier(.16,1,.3,1)`. Estados de botão respondem em (140ms); campos em (150ms); cards de OS e métricas em (160ms). Diálogo entra em (220ms) e backdrop em (180ms); toast e entrada de OS usam (220ms). O código também conserva uma animação de (360ms) para a classe de métricas antiga; ela não define a animação dos cards sólidos atuais. `prefers-reduced-motion: reduce` remove animações e transições.

## Do's and Don'ts

### Do:
- **Do** usar os tokens ativos da oficina para ação, estrutura e contraste.
- **Do** combinar a cor de situação com um rótulo escrito.
- **Do** manter a ação pertinente próxima à OS, respeitando permissões e estado offline.
- **Do** conservar Manrope local, números tabulares e hierarquia explícita.
- **Do** preservar foco visível e respeitar movimento reduzido.
- **Do** verificar leitura em notebook e mobile antes de repetir um tamanho compacto.

### Don't:
- **Don't** introduzir percentuais, comparações ou métricas sem origem nos dados.
- **Don't** usar a cor como única informação de estado.
- **Don't** acrescentar textura, ornamentação ou movimento que atrase o atendimento.
- **Don't** multiplicar controles concorrentes ou reduzir texto para acomodar mais conteúdo.
- **Don't** transformar os tamanhos auxiliares pequenos existentes em padrão mínimo de legibilidade.
- **Don't** fixar cores da oficina em componentes que devem acompanhar a personalização.

Não canonizado: tamanhos auxiliares de 10–12px e eventuais limites de densidade permanecem sujeitos à revisão de legibilidade; regras CSS antigas sobrescritas e animações de seletores sem uso atual não foram promovidas a normas. A documentação não declara aprovação da implementação nem corrige esses pontos.
