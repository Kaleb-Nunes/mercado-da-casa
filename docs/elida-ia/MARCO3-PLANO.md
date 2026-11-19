# Elida IA · Marco 3: plano (aguarda aprovação)

Data: 19/11/2026 · Nada foi contratado nem ativado.

## Necessidade central
Pesquisar um produto real, por nome ou código de barras, obter **ingredientes e advertências de alergênicos com fonte e data**, e cruzar com as restrições do perfil ativo usando o motor determinístico (`elida-regras.js`), sem nunca dizer que o produto é seguro.

## Verdade desconfortável
Nenhuma das duas opções acessíveis resolve sozinha. A base aberta traz ingredientes, mas a cobertura brasileira é incompleta e os dados são colaborativos. A base comercial brasileira identifica muito bem o produto, mas não traz ingredientes nem alergênicos. Por isso, a confirmação pela embalagem (foto e confirmação humana) continua obrigatória para fechar a lacuna.

## As duas opções

| Critério | A) Open Food Facts | B) Bluesoft Cosmos |
|---|---|---|
| Cobertura Brasil | Parcial e colaborativa. A base mundial tem cerca de 3 milhões de produtos de 180 países. O número de produtos brasileiros não foi medido (**pendente**) | Alta para identificar produtos do varejo brasileiro por GTIN. Diz ter cerca de 5,2 milhões de produtos (dado do próprio fornecedor) |
| Ingredientes e alergênicos | Sim, quando alguém da comunidade cadastrou. Vêm de fotos dos rótulos | **Não.** Traz descrição, marca, NCM, GPC, CEST, imagem e faixa de preço |
| Confiabilidade e atualização | Variável: depende de colaboradores, pode estar desatualizado ou ser de outra versão da embalagem | Bom para identificação fiscal e comercial. Não é fonte de rotulagem |
| Código de barras e nome | Sim, as duas | Sim, as duas (GTIN e busca por descrição) |
| Limites e licença | Sem chave. 100 consultas de produto por minuto e 10 buscas por minuto, contados por usuário quando a chamada sai do celular dele. Licença ODbL: uso comercial permitido com atribuição; base derivada precisa ser compartilhada na mesma licença | Exige token por usuário da API, com cota por plano. Termos comerciais e preços **pendentes de confirmação** (a página de preços não abriu) |
| Custo inicial | R$ 0 | Existe plano gratuito com cota baixa (**confirmar**) |
| Custo em escala | R$ 0 na API. Em volume alto, cache próprio (Cloudflare Workers ou KV, que tem plano gratuito) | Plano pago por volume (**valores a confirmar**), mais um backend para esconder o token (o front-end público não pode guardar chave) |
| Riscos | Falta de produto, ingrediente faltando ou desatualizado, dado colaborativo sem validação | Não resolve a necessidade central sozinho, há custo recorrente e dependência de fornecedor |

## Recomendação
1. **A como fonte de ingredientes**, sempre como evidência a confirmar: o app mostra a fonte, a data e o aviso "dado colaborativo". Se a ficha estiver incompleta ou antiga, o resultado é INFORMAÇÃO INSUFICIENTE (as regras atuais já fazem isso).
2. **B só depois do piloto**, se a falta de identificação de produtos se mostrar um problema real. Ele entra como identificação, nunca como fonte de alergênicos.
3. **Foto com confirmação humana** (já previsto no Marco 3) para fechar a lacuna: a pessoa fotografa e confirma o texto, e esse texto vira a fonte "embalagem conferida por você" com data.

## Próximos passos, se aprovado
1. **Piloto de cobertura (1 dia, R$ 0):** 100 códigos de produtos comuns de mercado, sem nenhum dado da família. Mede quantos são encontrados, quantos têm ingredientes e quantos têm alergênicos completos. Critério para seguir: 60% ou mais com ingredientes.
2. **Adaptador da opção A** no contrato v1 (`elida-busca.js`): chamada do próprio celular, sem chave e com User-Agent identificado. O perfil e as restrições nunca saem do aparelho (só o código ou o nome pesquisado). Também: tempo limite, cache com data e testes com respostas gravadas.
3. Tela de fonte e atribuição ODbL, e aviso de dado colaborativo.

Risco de privacidade: a consulta revela ao fornecedor qual produto foi pesquisado e o IP de quem pesquisou, mas não o perfil de saúde.
