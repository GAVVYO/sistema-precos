# Revisão visual — 16/11/2026

## Direção escolhida pelo cliente

Identidade automotiva técnica e precisa, com azul e grafite, mantendo interface clara e menu superior. Animações mais presentes em telas e gráficos. Prioridade: Início e Ordens de serviço. Estas escolhas atualizam a direção mais conservadora de `CONTEXTO-VISUAL.md`; os limites de arquitetura, personalização, permissões e offline continuam valendo.

## Diagnóstico e primeira implementação

| Superfície | Problema observado | Mudança realizada |
| --- | --- | --- |
| Cabeçalho | Marca, oito módulos, criação de OS, conexão e conta disputavam a mesma linha em 1366 × 768. | Identidade e controles na primeira faixa; navegação clara na segunda, mantendo o menu superior e o menu Mais em larguras menores. |
| Início | Seis indicadores com peso idêntico; tabela operacional comprimida em oito colunas. | Três etapas da OS em destaque e três indicadores auxiliares compactos. Tabela com quatro grupos, mantendo as informações, e ordenação ascendente/descendente por abertura, cliente, serviço e status. |
| Identidade | Ícone genérico de chave inglesa no acesso e no cabeçalho. | Monograma vetorial G inspirado em um instrumento, adaptado aos tokens da oficina, com ícone SVG para o navegador. Logotipo enviado pela oficina continua tendo prioridade. |
| Kanban | Seletor de movimentação competia com os dados em todos os cartões. | Controle mais discreto, placas destacadas, mais respiro, foco e hover claros; entrada de cartão ao mudar de coluna. Alternativa ao arrastar preservada. |
| Detalhes da OS | Cinco tipos de ação concorrendo no rodapé. | Rodapé com status, edição e pagamento; PDF e cancelamento agrupados no painel lateral. Confirmação de cancelamento preservada. |
| Formulários | Sugestões de cliente dependiam de um deslocamento fixo em pixels. | Posicionamento relativo ao campo em Nova OS e na agenda. |
| Movimento | Somente algumas transições de cor e carregamento; gráfico com animação desativada. | Entrada de telas, indicadores, modais, cartões e avisos; animação do gráfico financeiro. Sem dependência nova e sem atrasar a execução das ações. |
| Acessibilidade | Modal não estava explicitamente associado ao título por aria-labelledby. | Associação do título adicionada. Movimento CSS e Recharts respeitam prefers-reduced-motion. |

## O que realmente continua básico

1. **Agenda:** os cartões semanais truncam nomes/serviços e não comunicam ocupação ao longo do dia. A grade horária depende de esclarecer se o horário representa chegada ou execução, duração dos serviços e capacidade por mecânico/box. O modelo atual tem horário de início, sem duração. Não atribuir durações fictícias para desenhar uma grade.
2. **Tabelas dos demais módulos:** ainda não têm ordenação interativa/paginação. Priorizar estoque e clientes quando houver volume real; uma paginação arbitrária não melhora as pequenas listas da demo. Relatórios têm rolagem horizontal, necessária para o conjunto atual de colunas; pode-se evoluir para escolha de colunas.
3. **Financeiro:** dias sem movimentação produzem bastante espaço no gráfico. Uma visão semanal/mensal agregada pode melhorar a leitura, mas deve mostrar claramente a unidade e preservar os valores e as cores azul/âmbar já validadas.
4. **Configurações:** a pequena prévia de cores ainda representa o cabeçalho anterior em uma faixa. Atualizá-la junto com uma revisão da edição de temas e do contraste das cores personalizadas.
5. **Componentes:** combinações de classes conflitantes ainda não têm tailwind-merge. Centralizar variantes de tamanho e densidade antes de ampliar a família de controles.

Não considero ausência de tema escuro, ilustrações grandes, 3D ou fotografias uma deficiência para esta fase. Estados vazios precisam orientar a próxima ação; os existentes já fazem isso em boa parte dos fluxos. Esses recursos não foram adicionados automaticamente.

## Verificação

- Inspeção no navegador em 1366 × 768: Início, Ordens, Nova OS, detalhes da OS, Estoque, Financeiro, Agenda (semana/mês/dia), Clientes, Relatórios e Configurações.
- Ordenação por cliente conferida pela sequência dos registros e por aria-sort.
- OS-0010 movida para Em andamento e devolvida a Aguardando; conferidos coluna e aviso de sucesso. Apenas dados fictícios da cópia local foram alterados; o histórico da demo local registra as duas movimentações.
- Busca sem resultado e sugestões de cliente na Nova OS conferidas; nenhuma nova OS salva nesta revisão.
- Offline: aviso e botão Nova OS desativado; reconexão conferida.
- Perfil Mecânico: navegação reduzida e ausência de Nova OS; dashboard dos serviços atribuídos conferido.
- Segunda oficina: cores verde-azuladas e dados próprios preservados.
- `npm run typecheck`, `npm run lint`, `npm test` (32 testes): aprovados.
- `npm run build`: aprovado, com geração das 14 páginas. Duas tentativas iniciais falharam no processo de CSS do Turbopack; a compilação concluiu com servidor parado e cache limpo, preservando o cache anterior fora do repositório.

Não houve validação integral por teclado, com leitor de tela, em Safari/Firefox, nem teste de movimento reduzido por emulação do sistema. A implementação da preferência foi revisada no código. Arrastar com ponteiro não foi repetido nesta rodada; a alternativa acessível de movimentação foi exercitada. Os testes existentes cobrem regras de negócio, não regressão visual. `src/services`, `src/domain` e `src/demo` não foram alterados.
