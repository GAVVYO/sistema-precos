# Estado atual e continuidade — 16/11/2026

## Entrega

Projeto: GAVYO Auto, no repositório sistema-precos. Trabalho na branch feat/visual-oficina, PR #1. As alterações de código desta rodada terminam em f43be88; este documento e os índices foram adicionados depois. O envio ao GitHub não representa deploy ou merge na main.

Continua sendo uma demonstração com dados fictícios em localStorage, sem backend, autenticação real, sincronização ou integração de cobrança.

## Comportamento vigente

- Início: quatro indicadores sólidos, cores funcionais, filtros e próxima ação junto à OS.
- Busca global por placa, cliente ou número, com Ctrl/Cmd+K; Iniciar, Concluir e Receber conforme acesso e estado.
- Agenda: arraste pela alça para mudar o dia, mantendo horário, e botão de calendário para editar rapidamente dia/horário. Atendidos, cancelados e convertidos em OS permanecem protegidos. Conflitos de mecânico/horário usam a validação existente.
- Navegação: arraste a barra inteira pela alça. Ao aproximar do topo, aparece a indicação de encaixe; soltar restaura a faixa horizontal com animação de 220 ms. Não há menu de configuração. Dois cliques na alça ou Home também restauram o topo; setas movem por teclado.
- A posição flutuante é salva por usuário e oficina neste navegador. A ordem antiga dos atalhos é respeitada, mas a interface de reordenação foi retirada na simplificação pedida pelo cliente.
- Estoque/clientes: ordenação por colunas. Financeiro: semana/dia. Temas por oficina, permissões e estados offline preservados.

Os percursos prioritários são localizar OS, mudar status e receber pagamento. Não reduzir textos operacionais ou introduzir animações demoradas. Manter navegação simples e linguagem de oficina.

## Complemento: interface mais interativa

Commits após 548d111 (inspiração: praticidade do macOS):

- **Desfazer:** após reagendar (arraste ou edição rápida) ou mudar a etapa da OS (quadro, lista, busca), o aviso traz "Desfazer"; Ctrl/⌘+Z faz o mesmo enquanto o aviso estiver visível. Só é oferecido quando a regra permite voltar.
- **Busca Ctrl+K com comandos:** além das OS, mostra comandos (Nova OS, Novo agendamento, Ir para módulo), clientes e peças quando há texto. Clientes e peças abrem o módulo já filtrado (`?q=`).
- **Atalhos:** `N` nova OS; `G` + letra abre módulo (I Início, O Ordens, E Estoque, F Financeiro, A Agenda, C Clientes, R Relatórios, S Configurações). Não agem em campos de texto nem com modal aberto.
- **Painel do Início personalizável:** botão "Personalizar painel" permite arrastar, redimensionar (canto inferior direito) e ocultar blocos; "Restaurar padrão" volta ao layout original. Botões de cada bloco fazem o mesmo pelo teclado. Também no painel do financeiro. Salvo por usuário e oficina neste navegador.
- **Tabelas ajustáveis:** Estoque, Clientes e Veículos permitem ordenar, ajustar largura pela borda do cabeçalho e ocultar colunas (menu "Colunas"), com "Restaurar colunas".

Arquivos: `src/components/layout/order-search.tsx`, `src/components/layout/global-shortcuts.tsx`, `src/components/ui/widget-grid.tsx`, `src/components/ui/data-table.tsx`, `src/components/ui/toast.tsx`, `src/features/orders/move-order.ts`, `src/features/schedule/interactive-agenda.tsx`, `src/lib/prefs.ts`. Novas dependências: `react-grid-layout`, `@tanstack/react-table`.

Validação: typecheck, lint, 32 testes e build aprovados. No navegador (1366 × 768 e 820 px): busca com comandos, atalhos, desfazer na agenda e no quadro (inclusive Ctrl+Z), painel arrastado/persistido, tabelas com largura e ordenação persistidas, offline bloqueando arraste e atalhos de escrita, cargo Mecânico sem personalização e segunda oficina com suas cores. Não alterados: `src/services`, `src/domain`, `src/demo`.

## Executar

Requisitos e instalação estão no README. Na demo, não é necessário arquivo .env com credenciais.

```powershell
npm ci
npm run dev
```

Para servir uma compilação, execute npm run build e depois npm run start. A prévia local desta entrega foi servida na porta 3017; essa porta não é uma URL pública.

## Validação realizada

npm run typecheck, npm run lint, npm test (32 testes) e npm run build passaram na última alteração de código. Build gerou 14 páginas estáticas. Alterações posteriores desta entrega são documentação e capturas.

Conferidos no navegador: busca, próxima etapa, recebimento fictício, offline, cargos, segunda oficina, ordenação, gráfico e agenda. Na agenda, Rafael foi movido de quarta para quinta e depois devolvido ao dia/horário original por edição rápida. Na navegação, foram exercitados arraste livre, persistência, troca de orientação na versão anterior e, na versão final, arraste de retorno ao topo e persistência do encaixe após reload.

A revisão independente do redesenho cobriu os ajustes de legibilidade e pagamento; não constitui aprovação independente dos complementos posteriores de agenda/navbar.

Limites: não houve bateria integral em Safari/Firefox, leitor de tela ou emulação de movimento reduzido. A preferência de movimento foi revisada no código. Os testes automatizados existentes cobrem regras de negócio, não regressão visual. A agenda não modela duração/capacidade; não inventar uma grade horária para representar esses dados.

## Onde continuar

- docs/NAVEGACAO.md: comportamento final da barra, gestos e persistência. Prevalece sobre as descrições antigas de navegação do DESIGN.md.
- docs/REVISAO-VISUAL.md: diagnóstico, referências, percursos e histórico de validação.
- PRODUCT.md e DESIGN.md: contexto e identidade visual; a seção de navegação do DESIGN é anterior ao complemento por gesto.
- src/components/layout/movable-navigation.tsx: arraste, encaixe, animação e armazenamento da posição.
- src/components/layout/personal-navigation.tsx: links autorizados e ordem já salva.
- src/features/schedule/interactive-agenda.tsx: cartões, dias de destino e edição rápida.
- src/features/schedule/schedule-page.tsx: contexto de arraste e modos da agenda.

Não alterar src/services, src/domain ou src/demo em refinamentos visuais. Nenhum desses diretórios foi modificado nesta rodada. Preservar cores por oficina e as validações de negócio existentes.

![Navegação final encaixada](imagens/navbar-encaixe.png)

![Edição rápida de agendamento](imagens/agenda-edicao-rapida.png)

As imagens registram as fases respectivas da entrega; a captura de edição rápida precede o complemento final da navegação.
