# Funcionalidades implementadas e limitações (Fase 1)

## Como foi verificado

- **Testes automatizados** (`npm test`, 32 testes): regras de estoque, financeiro, agenda, permissões, isolamento entre oficinas, coerência do seed, relatórios, geração real de PDF e Excel, formatação e links de WhatsApp.
- **Verificação manual no navegador em 1366 × 768:** login, dashboards, criação de OS com peça, edição de quantidades, conclusão, pagamento via PIX, arrastar no Kanban, conversão de agendamento em OS, prévia do orçamento de WhatsApp, cores e permissões em Configurações, troca de cargo, troca de oficina, simulação offline, persistência após recarregar e restauração da demonstração.
- `npm run build`, `npm run typecheck` e `npm run lint` sem erros.

**Não verificado manualmente no navegador** (cobertos apenas por testes ou por revisão de código): clique nos botões de download de PDF/Excel, envio de logotipo, abertura efetiva do link `wa.me`, navegação somente por teclado em todas as telas, e uso em navegadores além do Chromium.

## Funcionalidades

**Acesso e navegação** — acesso de demonstração (oficina + usuário fictício), menu superior com módulos conforme permissões e módulos ativos, menu "Mais" em telas estreitas, Nova OS no cabeçalho, indicador de conexão, notificações, menu do usuário.

**Início** — dashboard operacional (proprietário/recepção): seis indicadores, serviços em andamento, agenda de hoje, alertas de estoque, atividade recente. Dashboard do mecânico (serviços atribuídos, iniciar/concluir) e do financeiro (recebido, despesas, a receber, resultado).

**Ordens de serviço** — Kanban de três colunas com arrastar e soltar e alternativa "Mover para…"; busca por número, cliente, placa ou veículo; filtros por responsável e período; contadores. Nova OS em modal com busca/cadastro rápido de cliente, veículo, serviço, peças e resumo. Detalhes com edição, peças, status, pagamento, WhatsApp, PDF, histórico de alterações e cancelamento com confirmação. Lista de canceladas.

**Estoque** — cadastro e edição de peças, indicadores, filtros, entrada / saída manual / ajuste, histórico com responsável e motivo. Baixa automática por OS, ajuste pela diferença, devolução ao remover ou cancelar, bloqueio de saldo negativo, correção explícita em OS concluída.

**Financeiro** — indicadores por período, gráfico de fluxo de caixa, receitas, despesas por categoria, contas a receber com "Registrar pagamento", receitas avulsas, faturamento separado de recebimentos, margem estimada por OS (custo das peças).

**Agenda** — visões de dia, semana, mês e próximos; criar, editar, reagendar, confirmar, cancelar e converter em OS (uma única vez, reaproveitando cadastro).

**Clientes e veículos** — busca por placa, nome ou telefone; cadastro e edição; histórico de manutenção derivado das OS.

**Relatórios** — ordens de serviço, movimentações financeiras, contas a receber, posição de estoque, movimentações de estoque, histórico de serviços; filtros; exportação em PDF (logotipo, oficina, título, período, data, totais) e Excel (.xlsx com datas e valores numéricos).

**WhatsApp** — orçamento e atualização de status com texto revisável e link oficial `wa.me`; validação de telefone brasileiro.

**Usuários e permissões** — quatro cargos como modelos, 18 permissões ajustáveis por funcionário, ativar/inativar, novo funcionário, proteção contra elevação de privilégio.

**Personalização** — nome, telefone, logotipo, cor principal e secundária, módulos ativos — por oficina.

**Demonstração** — duas oficinas fictícias isoladas, troca de usuário/oficina, simulação offline, restauração com confirmação, persistência local, aviso permanente de ambiente demonstrativo.

## Limitações

1. **Sem backend, banco ou autenticação real.** O "login" é um seletor de usuário fictício. Qualquer pessoa com acesso ao navegador vê e altera os dados da demo.
2. **Dados apenas no navegador** (localStorage, ~5 MB). Limpar os dados do navegador apaga tudo; não há sincronização entre computadores.
3. **Permissões e isolamento valem na camada de serviços do navegador** — demonstram o comportamento, mas não são segurança até existirem no servidor (Fase 2).
4. **Sem concorrência real:** as proteções contra baixa/pagamento duplicados são lógicas; travas de banco vêm na Fase 2.
5. **Offline é simulado.** Não há Service Worker; sem internet de verdade a página não carrega do zero.
6. **Layout pensado para desktop** (a partir de ~1280 px; testado em 1366 × 768). Não há versão para celular.
7. **Logotipo:** apenas PNG/JPG até 250 KB, guardado como data URL.
8. **Pagamento integral apenas**; sem parcelas, estorno de pagamento ou edição/exclusão de lançamentos financeiros.
9. **Peças e clientes não podem ser excluídos** (apenas editados), para preservar o histórico.
10. **Agenda sem controle de capacidade:** impede apenas o mesmo mecânico no mesmo horário.
11. **Testes cobrem regras de negócio e exportações**, não a interface (não há testes de componentes ou E2E automatizados).
12. Fora de escopo, conforme a especificação: NF-e/NFS-e, pagamento online, integração bancária, WhatsApp automatizado, portal do cliente, agendamento público, CRM, app nativo.
