# Decisões técnicas

| # | Decisão | Motivo |
| --- | --- | --- |
| 1 | **Projeto em pasta e repositório próprios** (`gavyo-auto`) | A sessão começou no repositório do Robô ISS (Python), sem relação com este produto. |
| 2 | **Serviços como funções puras `(db, ctx, input)`** | As mesmas regras rodam na demonstração, nos testes e, na Fase 2, dentro de transações Prisma. Trocar a persistência não exige reescrever regras nem telas. |
| 3 | **Seed construído pelos próprios serviços** | Garante coerência: toda OS paga tem receita, toda peça usada tem movimentação. Datas são relativas ao dia atual, para a demo parecer sempre recente. |
| 4 | **Dinheiro em centavos inteiros** | Evita erros de ponto flutuante; mapeia direto para `INT` no MySQL. |
| 5 | **`laborCents: null` ≠ `0`** | Diferencia "valor a definir" de "serviço gratuito", como pede a especificação. |
| 6 | **Cancelamento como atributo (`cancelledAt`)** | Mantém o Kanban com três colunas fixas; canceladas ficam em uma lista de consulta. |
| 7 | **Componentes próprios em vez do CLI do shadcn/ui** | A especificação permite "componentes acessíveis equivalentes". Evita dependências extras e o instalador interativo; modais usam `<dialog>` nativo (foco preso, Esc, leitores de tela). |
| 8 | **Avisos (toasts) em `popover`** | Precisam aparecer acima dos modais nativos, que ficam na *top layer* do navegador. |
| 9 | **React Hook Form não utilizado** | Os formulários são curtos; estado local + validação Zod no serviço bastou ("quando necessário"). |
| 10 | **Zod valida no serviço, não só no formulário** | A validação precisa valer também no servidor na Fase 2. |
| 11 | **jsPDF + jspdf-autotable e ExcelJS, carregados sob demanda** | Exportações reais no navegador, sem serviço externo. ExcelJS grava datas e números tipados. |
| 12 | **Cores do gráfico fixas (azul/âmbar)** | Par validado para daltonismo; não muda com a cor da oficina, para não perder legibilidade. |
| 13 | **`cacheComponents`/`partialPrefetching` desligados** | Na Fase 1 tudo é renderizado no cliente a partir do armazenamento local; a validação de pré-renderização do Next 16 não se aplica. Reavaliar na Fase 2. |
| 14 | **Fontes do sistema (Segoe UI)** | Aparência familiar de software de gestão no Windows e build sem depender de download de fontes. |
| 15 | **Prisma ainda não instalado** | O schema está versionado como referência; instalar agora adicionaria um passo de geração sem uso. |
| 16 | **Offline simulado não persiste ao recarregar** | Ao recarregar, vale o estado real do navegador (`navigator.onLine`). |
| 17 | **Veículo identificado pela placa (única por oficina)** | Abrir OS com placa já cadastrada reaproveita o veículo e atualiza o proprietário atual, sem duplicar. |
| 18 | **Receitas avulsas** | Além das receitas de OS, permite lançar receitas manuais (recebidas ou a receber), exigido por "Registrar data, cliente, OS, descrição…". |
| 19 | **Paleta de comandos com `cmdk` dentro de `<dialog>` nativo** | Busca única (OS, cliente, placa, peça) e atalhos estilo macOS (⌘K/Ctrl+K, `N`, `G`+letra, ⌘Z). O `<dialog>` mantém a paleta na *top layer*, acima dos outros modais; o `Command.Dialog` do cmdk (Radix) ficaria por baixo deles. |
| 20 | **Painel inicial com `react-grid-layout` v2** | Widgets arrastáveis e redimensionáveis, como os do macOS e do Grafana. O layout é preferência de interface (`src/lib/prefs.ts`, localStorage por usuário e oficina), não dado de negócio. Botões de mover e redimensionar atendem à WCAG 2.5.7. |
| 21 | **Agenda em grade de horários com dnd-kit** | Já estava no projeto. Arrastar remarca chamando `updateAppointment`, sem regra nova na interface. O dia mostra uma coluna por mecânico. Clicar abre o formulário, que é a alternativa sem arrasto. |
| 22 | **Tabelas com TanStack Table v9 (`DataTable`)** | Ordenação, largura ajustável pela borda do cabeçalho (com ← → no teclado) e colunas ocultáveis, tudo salvo por usuário. Estado controlado com `state` + `on*Change`. |
| 23 | **`tailwind-merge` no `cx`** | Resolve conflitos de classes (ex.: `h-9` + `h-7`), como sugerido em CONTEXTO-VISUAL. |
| 24 | **Desfazer após arrastar** | Remarcar um agendamento ou mover uma OS mostra "Desfazer" no aviso e aceita ⌘Z/Ctrl+Z. A volta usa o mesmo serviço e só é oferecida quando a permissão permite. |
