# Acessibilidade — 16/11/2026

Implementação local na branch `feat/visual-oficina`, a partir das propostas de [interfaces adaptáveis](IDEIAS-INTERFACE-ADAPTAVEL.md). Os recursos abaixo estão implementados; divisão de tela, desfazer e encaixe lateral com reorganização do conteúdo continuam como propostas separadas.

## Como usar

Abra **Acessibilidade** no cabeçalho (ícone de pessoa). Todos os cargos podem acessar, inclusive offline. Os ajustes são imediatos, ficam neste navegador e são separados por usuário e oficina. **Restaurar padrão** recupera as preferências iniciais sem mexer nos registros da demonstração.

- **Texto:** padrão, 125% e 150%. O zoom do navegador continua disponível. Os tamanhos da interface usam unidades relativas; o cabeçalho e a área de atendimento se reorganizam no modo ampliado.
- **Mais contraste:** escurece textos de apoio, reforça bordas e foco. A cor de ação conserva o matiz da oficina e é escurecida quando necessário para manter legibilidade. O valor configurado da oficina não é alterado.
- **Mais espaço para ler:** aumenta entrelinhas e espaços entre letras/palavras, com quebra de conteúdo.
- **Reduzir movimento:** desativa animações, inclusive as do gráfico financeiro e do retorno da navegação ao topo. A preferência do sistema também prevalece quando o ajuste pessoal está desligado.
- **Leitura ampliada:** acrescenta botões **Ampliar** a placas e descrições do atendimento e a placa, descrição e total nos detalhes da OS. A janela mantém o texto completo e selecionável. Também é possível selecionar texto na página e pressionar **Alt+L**. Não intercepta cliques de operações de serviço.

Se o navegador bloquear o armazenamento, o ajuste vale na sessão e um aviso explica que não pôde ser salvo. Preferências inválidas são descartadas em favor dos padrões.

## Teclado e alternativas ao arraste

O link **Pular para o conteúdo** aparece ao receber foco. O conteúdo principal recebe foco nas mudanças de página, e o título identifica a tela. Menus do cabeçalho funcionam como expansões com Tab e Esc. Janelas mantêm o ciclo de Tab/Shift+Tab e devolvem o foco ao acionador ao fechar, inclusive na leitura ampliada sobre os detalhes da OS.

Na alça da navegação, um clique abre **Posicionar navegação**, com topo, posição flutuante à esquerda/direita e deslocamento em passos. As setas continuam movendo a barra; Home retorna ao topo. O arraste mantém identificação do ponteiro e cancela o estado temporário ao perder captura ou foco da janela.

Agenda mantém **Reagendar** como alternativa ao arraste. O quadro de ordens mantém **Mover para…** e as próximas ações conforme permissão e conexão. Não foram alterados serviços, domínio nem dados da demonstração.

O financeiro oferece **Ver valores do gráfico em tabela**, com os mesmos agrupamentos e valores usados nas barras. A tabela do relatório pode receber foco para rolagem com teclado. Os seletores de relatório usam botões com estado pressionado, sem anunciar um grupo de rádios que não implementava as teclas desse padrão.

## Inspirações e decisões

- [Apple — recursos de visão](https://support.apple.com/en-euro/guide/mac-help/mchl67c83f41/27/mac/27): inspiração para separar tamanho, contraste, movimento e ampliação pontual, em vez de oferecer um único modo genérico.
- [W3C — redimensionamento de texto](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) e [espaçamento](https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html): tamanhos relativos, zoom preservado e conteúdo que quebra sem se sobrepor.
- [W3C — alternativas ao arraste](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): cliques de posicionamento além de suporte ao teclado.
- [W3C — tamanho de alvos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): áreas clicáveis maiores em controles compartilhados, leitura, fechamento e cores.
- [W3C — janelas modais](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): ciclo de foco, Esc, nome da janela e retorno ao acionador.

## Validação

Testes de unidade cobrem recuperação de preferências corrompidas, tipos inválidos, chaves por usuário/oficina e contraste das cores personalizadas. A suíte inclui as regras de negócio já existentes.

Conferência de navegador usa Chrome instalado no macOS, em perfil isolado, Playwright e axe-core. Foram exercitados abertura pelo teclado, ciclo de foco, Esc, leitura sobreposta, persistência após recarregar, troca de usuário/oficina, restauração offline, navegação sem arraste, movimento do sistema, cores forçadas e texto a 200%. A varredura inclui login e os oito módulos, com conferência adicional em 1366, 390 e 320 pixels e preferências ampliadas.

Resultado: typecheck, lint, 48 testes e build de 14 páginas passaram. As varreduras finais registradas não apontaram violações nas regras WCAG A/AA selecionadas do axe. Os oito módulos foram conferidos a 390 e 320px, com todos os ajustes ativos e texto a 150%, sem rolagem horizontal da página; tabelas e navegação mantêm rolagem interna quando necessário. O detector Impeccable retornou apenas avisos consultivos sobre a documentação de tokens e regras antigas. A ampliação de 2rem e a paleta de contraste são decisões documentadas em DESIGN.md.

[Evidências estruturadas da validação](validacao/acessibilidade-20261116.json). Não houve sessão manual com VoiceOver/NVDA nem teste em dispositivos físicos ou bateria em Safari/Firefox. As verificações automatizadas não constituem certificação integral WCAG.

## Atualização — 17/11/2026 (plano sem treino, menu lateral e animações)

- **Linguagem**: termos do dia a dia ("Serviço", "Pronto", "Começar", "Falta pagar", "Sem internet"); mensagens de erro dizem o que fazer.
- **Nomes sempre escritos**: abas, Avisos, Minha conta e botões de ação têm texto visível; nos casos em que o texto some por espaço (celular, menu lateral recolhido), o nome acessível continua e contém o texto visível (WCAG 2.5.3: "Minha conta — nome, cargo", "Ajustes — Configurações").
- **Alternativas ao arraste** (WCAG 2.5.7): mão de obra e quantidade aceitam clique e digitação; menu lateral por Minha conta e por Posicionar navegação; bandeja pelo ⋯; mudar etapa pelo botão do cartão e por "Mudar etapa".
- **Alvos** (WCAG 2.5.8): alça de arrastar com 24 px; caixinha de seleção afastada da alça; nome em "Quem falta pagar" com 32 px de altura.
- **Formulários**: Novo serviço mostra de uma vez os campos que faltam, com `aria-invalid` e mensagem ligada ao campo; troco com resultado em `aria-live`. Formas de pagamento são rádios de verdade (setas trocam).
- **Tour de primeira vez**: `role="dialog"`, foco no botão principal, Esc/✕/Pular encerram, ← → navegam; não abre por baixo de uma janela e não captura o Esc dela.
- **Movimento**: todas as animações (View Transitions, comemoração, tour, desenhos de pagamento, pílula, menu lateral) respeitam `prefers-reduced-motion` e a preferência "Reduzir movimento"; conferido com `reducedMotion: 'reduce'` (nenhuma transição iniciada).
- **Foco não escondido** (WCAG 2.4.11): `scroll-padding-top` ajustado ao cabeçalho de duas linhas e ao menu lateral.
- **Contraste**: barra lateral aberta com fundo sólido (texto "GAVYO Auto" passava a falhar sobre o vidro).

Validação: axe-core (WCAG 2.0/2.1/2.2 A e AA) sem violações em Hoje, Serviços, detalhes do serviço, Receber e menu lateral (recolhido e aberto), em 1366 e 390 px. Detalhes em [validacao/SEM-TREINO-20261117.md](validacao/SEM-TREINO-20261117.md). Continua sem sessão manual com leitor de tela.
