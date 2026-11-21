# Elida · apresentação do piloto

**Proposta.** O Elida ajuda quem cozinha para outra pessoa a transformar uma refeição já escolhida em uma lista de compras e a conferir as embalagens no mercado. A demonstração usa um perfil fictício e uma embalagem de teste. As fotos de abertura são ilustrativas.

## Demonstração de três minutos

| Tempo | O que mostrar | O que o investidor deve ver |
| --- | --- | --- |
| 0:00–0:30 | Abrir **Planejar meu jantar sem conta** e experimentar o prato brasileiro de exemplo. | A família consegue começar pelo celular. |
| 0:30–1:45 | Escolher **Usar minha própria refeição**, salvar um prato fictício e marcar o que já há em casa. Levar os ingredientes restantes à lista. | Só entram as compras que faltam. Voltar ao início mostra o prato salvo. |
| 1:45–2:30 | No início, abrir **Ler rótulo por foto**. Com um perfil fictício, revisar o texto de uma embalagem e repetir com uma foto ilegível. | A família revisa o texto e pode ver quando a informação é insuficiente. |
| 2:30–3:00 | Apresentar a proposta do piloto para a clínica. | Convidar famílias voluntárias, combinar duração e combinar como medir os resultados. |

## Arquitetura desta versão

O navegador carrega o aplicativo pelo Cloudflare Pages na homologação. O Supabase autentica a conta e verifica no servidor o papel e o status de acesso. Na versão piloto, a lista, o perfil alimentar e os históricos ficam no aparelho. O leitor de rótulos processa a foto no dispositivo. A cópia criptografada permite testar a recuperação em outro aparelho. Compartilhamento familiar entre dispositivos é uma etapa futura.

## Decisão de lançamento

| Responsável sugerido | Entrega para liberar a primeira versão | Evidência a guardar |
| --- | --- | --- |
| Produto e clínica parceira | Revisar mensagens sobre restrições, alergênicos e informações insuficientes com rótulos legíveis, incompletos e ilegíveis. | Casos revisados, divergências e limites do leitor. |
| Produto e privacidade | Explicar quais dados ficam no aparelho, quais chegam ao servidor e como solicitar suporte ou exclusão. Revisar o fluxo de perfis infantis antes de usá-lo com famílias reais. | Aviso de privacidade publicado e teste do atendimento a uma solicitação. |
| Engenharia | Configurar a origem pública, retornos de login/recuperação e e-mail transacional do ambiente final. Conferir permissões e cabeçalhos no domínio publicado. | Teste com conta comum e administradora, recebimento do e-mail e bloqueio após reabrir. |
| QA | Executar no Android físico e no iPhone físico: primeiro acesso, câmera, retorno do login, modo avião após o primeiro uso, atualização instalada e recuperação de senha. | Modelo do aparelho, versão do sistema e resultado para cada cenário. |
| Operação | Restaurar um backup em outra instalação, comparar perfis, listas e valores, ensaiar a volta para a versão anterior e definir quem recebe falhas. | Restauração conferida e versão anterior identificada. Registrar erros sem guardar imagens, ingredientes ou perfis pessoais nos logs. |

## Evidência comercial

Durante o piloto, medir quantas famílias convidadas concluem a primeira conferência, quantas precisam repetir a foto e quantas voltam em sete dias. Registrar o denominador e o período de cada indicador. Para discutir investimento, apresentar também a hipótese de quem paga, o custo observado por família ativa e o marco que o investimento financiará. Resultados clínicos, receita e retenção só entram na apresentação quando medidos.
