# Plano "uso sem treino" — 17/11/2026

## Contexto
Público: pessoas **sem experiência com sistemas** (exemplo usado: perfil de caminhoneiro que não mexe com informática). Usuários principais: **recepção no balcão** e **dono** (escritório ou celular). TV na parede é só ideia para demo (fica para depois).

Critério de sucesso: **uso real sem treino** — a pessoa entende o que fazer só olhando a tela.

Princípio: **o básico bem feito**. Nada de funcionalidade nova até a tela "Hoje" (passo 5). Recursos avançados já feitos (arrastar, Ctrl+K, atalhos N/G, bandeja, seleção múltipla, ajuste arrastando, mini janela) **ficam como atalhos**, nunca como único caminho.

## Decisões aprovadas pelo usuário
- "OS" → **Serviço**. Número exibido: **Serviço nº 11** (inclui PDF, Excel e WhatsApp).
- Etapa "Concluído" → **Pronto**.
- Pode alterar `src/domain` e `src/services` **se for coerente** (textos e mensagens; regras só se necessário e consistente).
- Pode atualizar os testes que conferem textos (`tests/reports.test.ts`: "Concluído", cabeçalho "OS", "OS-0001").
- Termos aprovados: Estoque "Movimentar" → **Entrada / Saída de peças**; "Movimentações" → **Histórico de peças**; "Saldo após" → **Ficou com**; Relatórios "Movimentações financeiras" → **Dinheiro que entrou e saiu**, "Posição de estoque" → **Peças em estoque**; Financeiro "Resultado de caixa" → **Sobrou no caixa**, "Receita avulsa" → **Entrada sem serviço**.

## Mapa de termos
| Antes | Depois |
|---|---|
| Ordem de serviço / OS | Serviço |
| Nova OS | Novo serviço |
| OS-0011 | Serviço nº 11 |
| Ordens de serviço (menu) | Serviços |
| Abrir OS / Converter em OS | Abrir serviço |
| Aguardando / Em andamento / Concluído | Aguardando / Em andamento / Pronto |
| Iniciar / Concluir (botões) | Começar / Marcar como pronto |

## Passos
1. ✅ **Auditoria sem treino** (lista abaixo).
2. ✅ **Linguagem** (Impeccable *clarify*): aplicar o mapa de termos em telas, mensagens de erro (`src/services`), rótulos (`src/domain/labels.ts`), `formatOrderNumber` (`src/lib/format.ts`), PDF/Excel (`src/lib/export.ts`), WhatsApp (`src/lib/whatsapp.ts`) e testes.
3. ✅ **Caminho principal visível**: botão escrito e grande para abrir serviço, mudar etapa e receber em cada tela; busca como campo visível.
4. ✅ **Telas que ensinam** (Impeccable *onboard*): estados vazios com próximo passo; dica na primeira vez para recursos de arrastar; confirmações claras.
5. **Tela "Hoje"** (primeira após login): "Quem chega hoje e a que horas" (botão "Chegou: abrir serviço") e "Quem falta pagar" (botão "Receber"). Só reorganiza dados existentes.
6. **Validação**: simular a pessoa sem experiência nas 4 tarefas (abrir serviço, mudar etapa, receber, achar cliente); idealmente teste com alguém real.

Depois: catálogo de serviços **para mostrar ao cliente** (página pública + link no WhatsApp), TV da parede.

## Auditoria (passo 1)
### Prioridade 1 — a pessoa trava
1. "OS" em ~60 pontos (17 arquivos) + 18 mensagens em `src/services` + PDF/Excel → Serviço.
2. Ilha: ≤1280 px abas viram só ícone → **nome sempre escrito**; excedente vai para "Mais".
3. Busca virou lupa → **campo visível** "Buscar placa ou nome do cliente".
4. Quadro: mudar etapa depende de arrastar/⋯ → botão escrito no cartão (**Começar / Marcar como pronto / Receber**).
5. Painel lateral: abrir completo só por duplo clique/ícone → botão grande **"Ver serviço completo"**.
6. Topo: acessibilidade, sino e avatar sem nome visível → rótulo curto ("Avisos", "Minha conta").

### Prioridade 2 — a pessoa se confunde
7. "Concluído" → Pronto.
8. Estoque: termos (ver decisões).
9. Painel: seleção Ctrl+clique, bandeja, arrastar valor, mini janela invisíveis → dica na 1ª vez + botão equivalente.
10. Início: "Personalizar painel" em destaque → mover para menu da conta ("Organizar tela inicial").
11. Início: "Agendamentos do dia 3 / Peças com estoque baixo 5" sem ação → viram botões ("3 clientes chegam hoje →").
12. Telas vazias só dizem "Nenhum…" → dizer o próximo passo com botão.
13. Barra de demonstração: "Simular queda de conexão" confunde leigo → manter, recolhida em "Opções da demonstração".

### Prioridade 3 — acabamento
14. ~50 `text-xs` (12 px) com informação (placa, data, responsável) → 14 px.
15. Relatórios: nomes técnicos (ver decisões).
16. Financeiro: termos (ver decisões).

## Como validar cada passo
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, e conferir no navegador em 1366×768 e 390 px (Proprietário e Mecânico, segunda oficina, offline).
