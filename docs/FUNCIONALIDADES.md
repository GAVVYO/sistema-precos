# Funcionalidades implementadas e limitações (Fase 1) — atualizado em 17/11/2026

Como usar cada tela: [INTERFACE.md](INTERFACE.md). Animações: [ANIMACOES.md](ANIMACOES.md).

## Como foi verificado

- **Testes automatizados** (`npm test`, 48 testes): regras de estoque, financeiro, agenda, permissões (inclui recepção recebendo e mecânico não), isolamento entre oficinas, coerência do seed, relatórios, geração real de PDF e Excel, formatação, links de WhatsApp e preferências de acessibilidade.
- **Simulação de pessoa sem experiência** ([validação](validacao/SEM-TREINO-20261117.md)): abrir serviço, mudar etapa, receber e achar cliente, só pelo texto visível, em 1366 × 768 e 390 px, como Proprietário e Recepcionista; axe-core (WCAG A/AA) sem violações em Hoje, Serviços, detalhes, Receber e menu lateral.
- **Navegador** (Chromium/Playwright): Proprietário, Mecânico, Recepcionista, segunda oficina (cores próprias), sem internet, movimento reduzido, 1366/1356×620/1024/390 px.
- `npm run build`, `npm run typecheck` e `npm run lint` sem erros.

**Não verificado manualmente**: clique real nos downloads de PDF/Excel, abertura efetiva do `wa.me`, leitores de tela (VoiceOver/NVDA), Safari e Firefox, dispositivos físicos. Teste com uma pessoa real ainda pendente (roteiro pronto).

## Funcionalidades

**Acesso e navegação** — acesso de demonstração (oficina + usuário fictício); cabeçalho em duas linhas com **busca sempre visível**, **Novo serviço**, Acessibilidade, **Avisos** e **Minha conta** escritos; abas sempre com nome (8/6/4 + "Mais" conforme a largura) e pílula que desliza; **menu no topo, flutuante ou na lateral** (empurra a página, abre com o mouse por cima); barra de abas embaixo no celular.

**Hoje** — primeira tela: **Quem chega hoje** (horário, Próximo/Atrasado/Já chegou, **Chegou: abrir serviço**) e **Quem falta pagar** (**Receber**); abaixo, indicadores, serviços com próxima ação, atividade e alertas de estoque, reorganizáveis em "Organizar tela inicial". Mecânico: "Meus serviços" com Começar / Marcar como pronto. Financeiro: painel próprio.

**Serviços** — quadro Aguardando / Em andamento / Pronto com botão da próxima etapa no cartão (Começar, Marcar como pronto, Receber); painel lateral (peças com + / −, mão de obra digitável ou arrastando, responsável, Ver serviço completo, mini janela); janela completa (edição, peças com motivo de correção, Mudar etapa, Receber, PDF, WhatsApp, histórico, cancelamento); busca, filtro por data, faixa de responsáveis; seleção múltipla, bandeja, arrastar, ⋯ Mover para; cancelados; desfazer.

**Novo serviço** — busca/cadastro de cliente e carro, o que o cliente pediu, mecânico, mão de obra, peças; obrigatórios conferidos de uma vez, com o campo marcado.

**Receber** — desenho da forma (cartão, cédulas, celular PIX, comprovante), formas em botões grandes, **troco** no dinheiro com atalhos; bloqueia valor menor que o total; comemoração ao confirmar. Também para entradas sem serviço.

**Estoque** — peças, indicadores, filtros, **Entrada / Saída** (chegou peça / saiu peça / contei o estoque), **Histórico de peças**. Baixa automática pelo serviço, ajuste pela diferença, devolução ao remover ou cancelar, sem saldo negativo, correção com motivo em serviço pronto.

**Financeiro** — indicadores por período (inclui **Sobrou no caixa**), gráfico com tabela acessível, recebimentos, despesas, **Entrada sem serviço**, contas a receber com **Receber**, valor dos serviços prontos separado do recebido, margem estimada por serviço.

**Agenda** — dia, semana, mês e próximos; criar, editar, mudar dia/horário (botão ou arrastar), confirmar, cancelar e **Chegou: abrir serviço** (uma única vez).

**Clientes e veículos** — busca por placa, nome ou telefone; cadastro e edição; serviços de cada cliente e veículo; Novo serviço a partir deles.

**Relatórios** — Serviços, Dinheiro que entrou e saiu, Contas a receber, Peças em estoque, Histórico de peças, Histórico de serviços; filtros; PDF e Excel.

**WhatsApp** — orçamento e atualização ("Serviço nº 11 … Situação atual: Pronto") com texto revisável e link `wa.me`.

**Usuários e permissões** — quatro cargos como modelos (Recepcionista recebe pagamento desde 17/11), permissões ajustáveis, ativar/inativar, proteção contra elevação de privilégio.

**Personalização** — nome, telefone, logotipo, cor principal e secundária (aplicadas ao cabeçalho, pílula, cartão de pagamento…), módulos ativos — por oficina. Preferências pessoais: acessibilidade, posição do menu, tela inicial, colunas de tabela, dicas vistas.

**Primeira vez** — tours guiados com balões, setas e ilustrações em Hoje, Serviços e painel; telas vazias que dizem o próximo passo com botão.

**Demonstração** — duas oficinas isoladas, troca de usuário/oficina (com animação), simulação de queda de conexão e restauração em "Opções da demonstração", persistência local.

## Limitações

1. **Sem backend, banco ou autenticação real.** O "login" é um seletor de usuário fictício.
2. **Dados apenas no navegador** (localStorage, ~5 MB); sem sincronização entre computadores.
3. **Permissões e isolamento** valem na camada de serviços do navegador; segurança real só com servidor (Fase 2).
4. **Sem concorrência real** (travas de banco na Fase 2).
5. **Offline simulado** (sem Service Worker).
6. **Celular funciona** (390 px conferido), mas o quadro de Serviços ainda empilha as colunas; abas por etapa estão no backlog.
7. **Animações** dependem da View Transitions API (Chrome/Edge; Safari 18+); sem suporte, as mudanças acontecem sem animação. Mini janela só em Chrome/Edge.
8. **Logotipo:** PNG/JPG até 250 KB, guardado como data URL.
9. **Pagamento integral**; sem parcelas, estorno ou edição de lançamentos. O troco é só cálculo de tela.
10. **Peças e clientes não podem ser excluídos** (só editados), para preservar o histórico.
11. **Agenda sem capacidade**: impede apenas o mesmo mecânico no mesmo horário; "Atrasado" usa o relógio do computador.
12. **Testes automatizados cobrem regras e exportações**; a interface é conferida por roteiros Playwright fora da suíte.
13. Fora de escopo: NF-e/NFS-e, pagamento online, integração bancária, WhatsApp automatizado, portal do cliente, agendamento público, CRM, app nativo.
