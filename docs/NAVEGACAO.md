# Navegação personalizável

A barra superior mantém os módulos e permissões existentes, com seleção preenchida, ícones e feedback curto. A implementação vigente está em src/components/layout/personal-navigation.tsx, usada pelo Header do AppShell; substitui apenas a antiga faixa de links descrita em DESIGN.md. Os demais tokens e componentes permanecem na identidade estabelecida.

Organizar abre edição explícita. Arrastar um módulo para os lados muda a ordem ao soltar. Setas oferecem alternativa por teclado e toque. Concluir retorna aos links normais. Restaurar ordem repõe a sequência padrão.

Preferência local por usuário/oficina em gavyo:navigation:v1:<oficina>:<usuario>. Não sincroniza entre navegadores. Dados inválidos ou armazenamento indisponível usam ordem padrão; falha ao salvar mostra aviso. Somente módulos já autorizados entram na barra. Esta preferência de apresentação pode ser alterada offline.

Referência de interação: [personalização da navegação do Salesforce](https://help.salesforce.com/s/articleView?id=xcloud.user_userdisplay_tabs_lex.htm&language=en_US), especialmente reordenação com arraste e modo de edição. Identidade visual própria do GAVYO.

Verificação: typecheck, lint, 32 testes e build aprovados. Arraste Agenda→posição2 executado no navegador; ordem persistiu após reload. Setas por Enter e restauração exercitadas. Desktop1366×768 e mobile390px inspecionados; no mobile a rolagem fica restrita ao trilho (documento380px dentro de viewport390px). A preferência usada no teste foi restaurada.
