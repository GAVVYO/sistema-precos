# Auditoria "pessoa leiga" — 18/11/2026

Pedido do usuário: o site ainda é difícil para quem não é dev nem tem costume com sistemas. Sem funcionalidade nova: só melhorar o que existe (grid, fluxo, formulários). Método: todas as telas e janelas capturadas em 1366×768 e 390 px e lidas como uma pessoa do balcão que nunca usou sistema.

## Diagnóstico em uma frase
As telas principais (Hoje, quadro, Receber) já falam a língua do balcão, mas **os formulários e as telas secundárias ainda são de "programa de escritório"**: muitos campos de uma vez, listas suspensas, tabelas de planilha e palavras de contador.

## 1. Formulários (maior problema)

| # | O que trava | Onde | Proposta |
|---|---|---|---|
| F1 | **12 campos de uma vez**, em duas colunas, com seções (CLIENTE, VEÍCULO, SERVIÇO, PEÇAS) | Novo serviço | **Uma pergunta por vez** (passo a passo): 1) Qual a placa? → se o carro já existe, "É o Fiat Uno da Maria? Sim/Não"; 2) Nome e telefone (só se for cliente novo); 3) O que o cliente pediu? (com sugestões em botões: Troca de óleo, Revisão, Freios…); 4) Quem vai fazer? (botões com o nome de cada mecânico + "Ainda não sei"); 5) Conferir e **Abrir serviço**. Enter avança; "Voltar" sempre visível. |
| F2 | **Listas suspensas** (select) para poucas opções: mecânico, categoria, situação, período, etapa, peça | Quase todos | Trocar por **botões grandes** (como as formas de pagamento). Select só para listas longas, e com busca. |
| F3 | **Campos opcionais misturados** com obrigatórios (Ano, Quilometragem, Observações, Código interno, Descrição, Quantidade mínima) | Novo serviço, Nova peça, Agendamento, Despesa | Esconder em **"Mais detalhes (opcional)"**. Mostrar só o essencial. |
| F4 | **Regras escritas em letra pequena**: "Em branco = valor a definir. Informe 0 para serviço gratuito", "Abaixo ou igual gera alerta" | Mão de obra, Nova peça | Botões de escolha: **"Já sei o valor / Ainda não sei / Não vai cobrar"**; "Me avise quando tiver menos de __". |
| F5 | **Exemplo dentro do campo parece já preenchido** ("ABC1D23", "Fiat", "Uno", "FIL-001", "0,00") e o campo Nome diz "Nome, telefone ou placa" | Vários | Campo vazio com a pergunta no rótulo; exemplo em texto pequeno embaixo. |
| F6 | **Data e hora do navegador** (calendário pequeno, formato que muda conforme o computador) | Agendamento, Despesa | Atalhos **Hoje / Amanhã / dias da semana** e horários em botões (08:00, 09:00…); calendário só em "Outro dia". |
| F7 | **Janela em cima de janela** (Editar abre outra janela sobre a do serviço) | Detalhes do serviço | Editar **no lugar** (o campo vira editável na própria janela). |
| F8 | No celular, **2 colunas de campos estreitos** e rodapé com 3 linhas de valores | Novo serviço (390 px) | Uma coluna; com o passo a passo (F1) resolve. |

## 2. Telas e grid

| # | O que trava | Onde | Proposta |
|---|---|---|---|
| G1 | **Hoje tem 3 telas de rolagem**: depois dos dois blocos úteis vêm 4 cartões coloridos, uma tabela com 5 filtros + busca, atividade recente e alertas de estoque — muita coisa repetida do quadro | Hoje | Hoje só com **Quem chega · Quem falta pagar · Carros na oficina** (lista curta com o botão da próxima etapa) e **uma linha** "4 peças acabando → Ver". O resto fica no quadro e no Estoque. |
| G2 | **Tabelas de planilha** (setas de ordenar, "Colunas", código, custo, venda, 7–9 colunas) | Estoque, Clientes, Financeiro | **Lista em cartões**: nome grande, a informação que importa e uma ação. Estoque: "Filtro de óleo · **21 unidades** · Tem" (ou **Acabou / Está acabando**). Custo, código e venda dentro do detalhe. |
| G3 | **14 botões "Entrada / Saída" iguais** + "⋯" em cada linha | Estoque | Clicar na peça abre ela com **"Chegou mais" / "Saiu"** grandes. |
| G4 | "Disponível **0 / min. 2**" | Estoque | "**Acabou** (o mínimo é 2)". |
| G5 | Financeiro com 4 números coloridos + gráfico + 3 abas + nota de rodapé contábil | Financeiro | Uma frase grande: **"Em novembro entrou R$ 2.062, saiu R$ 1.835, sobrou R$ 228. Faltam receber R$ 1.040."** Abaixo, "O que entrou" / "O que saiu" como listas. Gráfico recolhido em "Ver gráfico". |
| G6 | Agenda abre na **semana** (7 colunas estreitas, nomes cortados "Maria do", ícones ⋮⋮ e 📅 sem nome) | Agenda | Abrir no **Dia** (lista como o Hoje) com setas "← ontem / amanhã →"; semana e mês como opção. Ícones com nome ("Mudar horário"). |
| G7 | **Duas buscas** na tela Serviços (topo + filtro da página) e filtro "Qualquer data de abertura" | Serviços | Uma só busca; filtro de data recolhido em "Filtrar". |
| G8 | Elementos de "power user" sempre visíveis: **Ctrl K**, alça **⋮⋮** do menu, caixinha de seleção, "Bandeja" fixa no canto | Topo, quadro | Mostrar só ao passar o mouse / em "Minha conta › Modo avançado"… **(atenção: decisão 49 assumiu o estilo sistema operacional — manter, mas discreto)**. |
| G9 | Configurações em linguagem técnica: "Módulos ativos", "Cor secundária (aba ativa e avatar)", "#172033" | Configurações | "O que aparece no menu", "Cor do menu", sem código de cor. |

## 3. Palavras que ainda travam
Receitas recebidas → **Entrou** · Despesas pagas → **Saiu** · Contas a receber → **Falta receber** · Fluxo de caixa → **Entradas e saídas** · Custo unitário → **Quanto paguei** · Preço de venda → **Quanto cobro** · Código interno → **Código (opcional)** · Quantidade mínima → **Avisar quando tiver menos de** · Histórico de alterações → **O que aconteceu** · Situação/Etapa (em listas) → manter "Etapa" só no quadro · Margem estimada / faturamento → esconder para quem não é dono.

## 4. Proposta de ordem (sem função nova)
1. ✅ **Novo serviço passo a passo** (F1, F4, F5, F8) — feito em 18/11 (decisão 56).
2. **Selects → botões** e **opcionais em "Mais detalhes"** em todos os formulários (F2, F3, F6).
3. **Hoje enxuto** (G1).
4. **Estoque e Clientes em cartões** (G2–G4).
5. **Financeiro em frase** + palavras (G5, seção 3).
6. **Agenda no Dia** (G6), busca única em Serviços (G7), editar no lugar (F7), Configurações (G9).

Cada passo validado com a simulação sem treino (`docs/validacao/simular-sem-treino.js`) e axe.
