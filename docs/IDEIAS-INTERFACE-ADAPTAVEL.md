# Ideias para interfaces adaptáveis

Registro de possibilidades discutidas em 16/11/2026. São propostas para evolução, não funcionalidades entregues nem aprovação para implementar todas de uma vez.

## Prioridade sugerida

1. **Bordas magnéticas:** ao arrastar a navbar para a esquerda/direita, mostrar uma prévia do encaixe e abrir espaço no conteúdo ao soltar. O encaixe no topo já existe; as laterais ainda são proposta.
2. **Divisão de tela:** manter uma OS aberta ao lado da agenda ou estoque, com separação redimensionável e proporção salva.
3. **Desfazer:** ✅ entregue para reagendamento e mudança de etapa da OS (aviso com "Desfazer" e Ctrl/⌘+Z). Pagamentos e operações irreversíveis continuam sem reversão genérica.

## Outras possibilidades

| Ideia | Uso proposto |
| --- | --- |
| Painéis móveis | Reposicionar ferramentas e consultas sem perder o serviço em andamento. |
| Leitura ampliada | Ampliar placa, valor ou descrição por foco e ação acessível, preservando zoom nativo e leitor de tela. |
| Busca com comandos | Localizar e iniciar ações como agendar ou receber uma OS; manter confirmações e permissões. |
| Preferências pessoais | Lembrar organização e proporções por usuário/oficina, com recuperação simples do padrão. |
| Movimento com significado | Usar prévia de destino, encaixe e retorno curto para explicar o resultado do gesto, respeitando movimento reduzido. |

## Princípios

- A interface acompanha a intenção do usuário, com poucos controles e linguagem clara.
- Priorizar localizar OS, mudar status e receber pagamento; manter acesso objetivo às ações.
- Preservar legibilidade, contraste, teclado, leitor de tela e alvos confortáveis.
- Toda operação por arraste deve oferecer alternativa por clique/toque; suporte ao teclado também é necessário. Evitar controles de configuração permanentemente expostos.
- Uma ferramenta encaixada deve reorganizar o conteúdo para evitar cobri-lo.
- Preferências devem ser recuperáveis e não alterar permissões ou dados de outras oficinas.
- Implementar e avaliar uma interação por vez antes de expandir o padrão.

## Inspirações pesquisadas

- [Apple — Tile windows on Mac](https://support.apple.com/guide/mac-help/tile-app-windows-mchlef287e5d/27/mac/27): encaixe com áreas de destino indicadas durante o arraste.
- [Microsoft — FancyZones](https://learn.microsoft.com/en-us/windows/powertoys/fancyzones): organização do espaço por zonas.
- [VS Code — Custom Layout](https://code.visualstudio.com/docs/configure/custom-layout): painéis móveis, divisão do espaço e persistência do layout.
- [Apple — Increase the size of what is on screen](https://support.apple.com/en-gb/guide/mac-help/mchlbc4c53ca/27/mac/27): ampliação e Hover Text.
- [Raycast — Search Bar](https://manual.raycast.com/search-bar): acesso rápido por busca.
- [W3C — Dragging Movements, WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements): alternativa de ponteiro sem arraste, além de acessibilidade por teclado.

As aplicações ao GAVYO acima são propostas próprias a partir dessas referências, sem copiar marcas ou prometer conformidade de acessibilidade ainda não validada.
