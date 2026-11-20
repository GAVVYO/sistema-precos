# GAVYO Auto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Proprietário, recepção, mecânicos e financeiro de pequenas oficinas. Usuários principais: **recepção no balcão e dono**, muitas vezes **sem experiência com sistemas**. Critério de sucesso: **uso real sem treino** (a pessoa entende o que fazer só olhando a tela). Uso prioritário em notebook/desktop (1366 × 768), com celular conferido em 390 px.

## Product Purpose

Reunir serviços (antes chamados de ordens de serviço), clientes, veículos, estoque, agenda e financeiro. O cliente confirmou como prioridade localizar o serviço, mudar a etapa e receber pagamento; a tela **Hoje** responde quem chega e quem falta pagar. Chegar à ação principal em até três cliques; preencher informações obrigatórias e confirmar operações não é dispensado por esse objetivo.

## Operating Context

Durante o atendimento, entender serviço e pendências rapidamente. Textos pequenos, excesso de elementos e animações demoradas são falhas explicitamente rejeitadas pelo cliente. Menu no topo por padrão; o usuário pode fixá-lo na lateral. Estilo **sistema operacional** assumido (decisão 49), sempre com caminho principal escrito e alternativa ao gesto.

## Capabilities and Constraints

Demo Next.js 16 / React 19, dados fictícios em localStorage; sem backend, autenticação real, sincronização ou pagamentos online. Preservar serviços, domínio e seed, regras de estoque, permissões, isolamento de oficinas, estados offline e confirmações. Exportações e WhatsApp continuam nos fluxos existentes. Toda ação real passa por useApp/act.

## Brand Commitments

Nome GAVYO Auto, idioma pt-BR. Clareza profissional com identidade automotiva. Cards de métricas sólidos aprovados pelo cliente; cores associadas à função e coerentes com a oficina. O cliente autoriza redesenhar o frontend completo com referências de produtos similares e efeitos visuais perceptíveis, mantendo objetividade.

## Evidence on Hand

docs/ARQUITETURA.md, docs/FUNCIONALIDADES.md e docs/CONTEXTO-VISUAL.md. Duas oficinas e cargos fictícios no seed. Sem inventar comparações comerciais, percentuais de evolução, recursos ou integrações.

## Product Principles

- Linguagem de balcão: "Serviço", "Pronto", "Começar", "Falta pagar" — nunca jargão de sistema.
- O caminho principal é um botão escrito; arrastar e atalhos são extras.
- Animação mostra o que aconteceu, nunca atrasa o trabalho.
- Localizar o serviço sem navegar por vários módulos.
- Estado e próxima ação ficam próximos ao serviço.
- Linguagem clara, boa legibilidade e poucos controles concorrentes.
- Movimento dá feedback e não retarda o trabalho.
- Nenhuma mudança visual remove restrições de permissão ou offline.
