# Elida · apresentação do piloto

**Proposta.** O Elida ajuda famílias a conferir os ingredientes de uma embalagem e a organizar a lista e o orçamento das compras. A demonstração usa um perfil fictício e uma embalagem de teste. As fotos de abertura são ilustrativas.

## Demonstração de três minutos

| Tempo | O que mostrar | O que o investidor deve ver |
| --- | --- | --- |
| 0:00–0:30 | Abrir o Elida e entrar como visitante. | A família consegue começar pelo celular. |
| 0:30–1:45 | Usar um perfil fictício de restrição ao leite, abrir **Ler rótulo por foto**, escolher a foto e conferir o texto com a embalagem. | O usuário vê o que foi lido e revisa o texto. Repetir com uma foto ilegível para mostrar o estado de informação insuficiente. |
| 1:45–2:30 | Abrir a lista, escolher um produto e mostrar o orçamento do mês. | A família pode usar a conferência e a organização de compras na mesma rotina. |
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
