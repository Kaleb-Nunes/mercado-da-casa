# Despensa

App de bolso pra controlar a comida da casa: preços do mercado, lista de compras, balanço do mês e dieta (editável).

Abrir: https://kaleb-nunes.github.io/mercado-da-casa/

- iPhone: Safari → Compartilhar → Adicionar à Tela de Início.
- Android: Chrome → ⋮ → Adicionar à tela inicial (ou Instalar app).
- Funciona sem internet depois da primeira abertura.
- Os dados ficam no próprio celular. Use **Fazer backup** uma vez por mês (as fotos dos produtos não entram no backup).

## Marca

Símbolo: um pote de despensa com uma folha dentro, tampa em latão. Cores: Verde Despensa #0F3B2E, Latão #D9B45A, Creme #F4F1E6, Tinta #10261F, Névoa #F1F3EF. Tipos: Fraunces (títulos e valores) e Onest (textos).
Arquivos em `marca/`.

## Importar compra do cupom

Foto do cupom → Claude lê → `tools/gerar_importacao.py cupom.json` gera a mensagem com o link `#importar=...`.
- Android: tocar no link.
- iPhone: abrir o app, tocar em **Importar compra do cupom** e colar a mensagem inteira (o app da tela de início guarda os dados separado do Safari).
O app lança o gasto do mês, guarda o preço de cada item naquele mercado, cria os itens novos, tira da lista o que foi comprado e não deixa importar a mesma nota duas vezes (usa a chave de acesso da NFC-e como id).

## Ofertas da semana

Tela **Ofertas da semana** (cartão no Início e botão em Preços). Lê o `ofertas.json` deste repositório toda vez que o app abre com internet e guarda uma cópia pra usar sem internet.

O `ofertas.json` tem:
- `encartes`: encartes valendo nos mercados de BC e Camboriú, com período e link. Somem sozinhos quando vencem.
- `rotinas`: dias fixos de oferta (`dias`: 0 = domingo … 6 = sábado). O app avisa "Hoje tem…".
- `avisos`: recados com data pra sumir (`ate`), com fonte.
- `ofertas`: preços de oferta por produto (`m`, `nome`, `cat`, `por`, `p`, `de`, `ini`, `fim`, `item` opcional).
- `sem_encarte`: mercados que não publicam encarte na internet.

Preço de oferta por produto também entra por código, igual ao cupom: foto do encarte → Claude lê → `tools/gerar_ofertas.py encarte.json` gera a mensagem com `#ofertas=...`. No app, cada oferta aparece comparada com o último preço pago, marcada se estiver fora da dieta, e o botão **+ Lista** põe o item na lista com o preço da oferta. Ao finalizar a compra no mesmo mercado da oferta, o preço guardado é o da oferta.
