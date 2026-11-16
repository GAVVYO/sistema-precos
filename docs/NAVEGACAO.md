# Navegação por gesto

A barra é movida pela alça permanente, sem botão de configuração. Ao arrastar e aproximar o ponteiro da faixa original (topo do cabeçalho +64px), aparece a indicação Solte para encaixar no topo. Soltar nessa zona restaura a barra horizontal e apaga a posição flutuante salva. O retorno usa animação de220ms; o indicador entra em140ms. prefers-reduced-motion desativa ambos.

Fora dessa zona, a barra permanece flutuante na posição escolhida. Posição e orientação são limitadas à viewport e salvas por usuário/oficina neste navegador. Dois cliques na alça ou tecla Home retornam ao topo como alternativas ao gesto; Escape cancela o arraste. Setas mantêm a alternativa de deslocamento por teclado.

O menu de três pontos e os controles de posicionamento/reordenação foram retirados para simplificar o uso, conforme pedido. A ordem previamente salva dos atalhos ainda é respeitada. Esta versão substitui o fluxo anterior de configurações da barra. Apenas módulos autorizados são exibidos.

Verificação: typecheck, lint,32 testes e build aprovados. No navegador1366×768, barra retirada do topo e solta no meio da tela; depois arrastada novamente para y130px. A classe voltou a movable-nav-frame, sem nav-floating. Reload manteve o encaixe. Captura final em outputs/gavyo-redesign/navbar-encaixe.png. Não houve alterações em serviços, domínio ou demo. Movimento reduzido foi conferido no código, sem emulação do sistema nesta rodada.
