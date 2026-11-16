# Revisão visual — 16/11/2026

## Direção implementada

Atendimento de oficina com identidade técnica: cabeçalho grafite, Manrope local, superfícies claras, quatro cards sólidos e cores por função. Espera usa âmbar; execução usa a cor principal da oficina; conclusão usa verde; veículos usam a cor de estrutura. Os números vêm dos dados atuais, sem percentuais decorativos.

A escolha `atendimento` foi confirmada na comparação de direções em HTML (caminho code-first). O cliente priorizou localizar OS, mudar status e receber pagamento, rejeitando textos pequenos, excesso de elementos e animações demoradas.

## Mudanças

| Superfície | Resultado |
| --- | --- |
| Cabeçalho | Marca e busca global na primeira faixa; menu superior separado, com rolagem local nas larguras menores. Busca por placa, cliente ou número; atalho Ctrl/Cmd+K. |
| Início | Quatro cards aprovados como referência de composição. Cards e filtros selecionam a lista de serviços. Próxima ação aparece junto à OS. Agenda e estoque ficam como apoio. |
| Ordens | Serviço, placa e responsável mais claros. Iniciar, Concluir ou Receber junto ao registro; detalhes e alternativa ao arrastar preservados. |
| Pagamento | Confirmação do valor preservada. Formas em duas colunas no modal compacto, tanto no celular quanto no desktop, com alvos de pelo menos 44px. |
| Estoque e clientes | Ordenação nas colunas relevantes. Código da peça e mínimo agrupados com nome e quantidade para reduzir largura. |
| Financeiro | Visão semanal padrão e alternância diária, conservando totais, período e par azul/âmbar do gráfico. Animação curta. |
| Agenda | Semana mais legível, textos de serviço com quebra e horário separado. Rolagem dentro da semana em telas estreitas. |
| Configurações | Prévia acompanha o cabeçalho novo; contraste preto/branco calculado para as cores personalizadas. |
| Componentes | Manrope servida localmente, base rem de 16px, texto operacional de 14px, mesclagem de classes com tailwind-merge, foco e feedback consistentes. |
| Movimento | Entrada de tela em 180ms, diálogo em 220ms e gráfico em 360ms. Respeita prefers-reduced-motion e não atrasa a execução das ações. |

## Percursos prioritários

A partir de qualquer módulo com acesso a OS:

- Localizar: focar a busca (1), digitar placa/cliente/número, abrir resultado (2).
- Mudar para a próxima etapa: focar a busca (1), digitar, Iniciar ou Concluir (2).
- Receber OS concluída: focar a busca (1), digitar, Receber (2), confirmar PIX (3). Trocar a forma de pagamento acrescenta uma seleção.

A contagem mede cliques, sem tratar digitação como clique. Não elimina revisão do valor, confirmação de pagamento ou informações necessárias de um cadastro novo.

## Referências pesquisadas

Foram aproveitados padrões de operação, sem copiar marcas ou telas:

- [Shopmonkey — workflow](https://www.shopmonkey.io/product/workflow): localização e acompanhamento do serviço.
- [Tekmetric — painel em tempo real](https://support.tekmetric.com/hc/en-us/articles/360042280134-Shop-Dashboard-Real-Time-Reporting): leitura de situação e indicadores úteis ao trabalho.
- [Oficina Integrada — funcionalidades](https://comofunciona.oficinaintegrada.com.br/mais-funcionalidades): consulta por OS, cliente e placa no contexto brasileiro.

## Verificação

Conferência visual em 1366 × 768 dos oito módulos, Nova OS, busca global e pagamento; início e pagamento também em 390px. Testados busca sem resultado, Ctrl+K/Escape, ordenação de estoque/clientes, agrupamento diário/semanal, próxima etapa, recebimento integral em PIX, offline, perfil Mecânico e segunda oficina.

A OS-0010 da cópia local foi iniciada, concluída e recebida por R$ 202 em PIX. Apenas dados fictícios do localStorage foram usados; não houve cobrança real. A OS-0008 foi usada para abrir o pagamento sem confirmar.

A revisão independente pediu maior texto operacional e reorganização das formas de pagamento mobile. Os ajustes foram aplicados e recapturados. Veredito final independente: ship, com os dois ajustes e a regressão desktop pontuados como resolvidos; a aprovação cobre esse lote de correções.

Validação técnica: npm run typecheck, npm run lint, npm test (32 testes) e npm run build aprovados. A última alteração foi somente a grade CSS do pagamento; a compilação final também passou. Foram geradas as 14 páginas estáticas.

Limites: não houve bateria integral com leitor de tela, Safari/Firefox ou emulação de movimento reduzido pelo sistema. A preferência foi revisada no código. Arrastar por ponteiro não foi repetido; o controle alternativo foi exercitado. Testes existentes cobrem regras de negócio, não regressão visual. A agenda ainda não modela duração/capacidade: não foi inventada uma grade horária com dados inexistentes.

`src/services`, `src/domain` e `src/demo` permanecem sem alterações. Continua sendo frontend de demonstração, sem backend ou integração de cobrança.
