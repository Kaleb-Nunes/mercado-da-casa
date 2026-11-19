# Piloto Open Food Facts: 100 GTINs brasileiros

Data: 19/11/2026 · Branch: `feature/perfis-inteligentes-rotulos` · Custo: R$ 0 · Integração com o app: **não feita** (aguarda aprovação)

## Recomendação: AJUSTAR

O critério exploratório não foi atingido. Os ingredientes vieram em **44 de 100** produtos (IC95% 34,7–53,8%). O critério era 60% ou mais, e nem o limite superior do intervalo chega lá. Na comparação manual com fotos de rótulos, o texto do OFF **omitiu a declaração de alergênicos impressa na embalagem em 2 de 7 produtos**. Nos dois, a declaração incluía "pode conter leite".

Mesmo assim, não recomendo descartar. A identificação pelo código de barras funcionou bem: 94/100 corretos, resposta rápida e nenhum erro com o ritmo controlado. Com o mapeamento conservador, a falha do app foi sempre "informação insuficiente", nunca uma falsa tranquilidade. O OFF serve para **identificar o produto e pré-preencher os ingredientes como rascunho**. Ele não serve como fonte de "advertências completas". Isto **não é validação clínica**.

## Como foi feito

- **Amostra:** 100 GTINs de alimentos, 10 grupos de 10, sorteados de uma base independente de varejo brasileiro. A base é o repositório público NeofitoEOF/bigdata, com dados de dez/2024 a jan/2025. Nenhum dado da família foi usado.
- **Leitura de produto:** API v2, um GTIN a cada 4,6 s (cerca de 13/min). O limite oficial é 15/min por IP.
- **Busca por nome:** API nova (`search.openfoodfacts.org`), uma consulta a cada 7,5 s (8/min). O limite oficial é 10/min por IP.
- **Erros 429 e 503:** espera de 30 s e nova tentativa, com limite de tentativas. Não houve lote sem controle.
- **Identificação:** User-Agent `Elida-piloto/0.1 (+URL do repositório)`.
- **O que saiu daqui:** só o GTIN ou termos genéricos do nome do produto. Nenhum perfil, dado de saúde, dado familiar ou foto foi enviado.
- **Motor do app:** o `ElidaRegras` rodou sobre os dados do OFF (APLV e celíaca) só para medir o comportamento.

## Resultados

Denominador 100, salvo indicação.

| Métrica | Resultado | IC95% |
|---|---|---|
| Encontrados por GTIN | 98 | 93,0–99,4% |
| Corretamente identificados | 94 (84 por heurística de nome e marca, 10 por revisão manual) | 87,5–97,2% |
| Variante não confirmada | 3 (Leite Moça semidesnatado, kit Chocotone, Chambinho sorvete) | |
| Identificação divergente | 1 (linguiça cuiabana × "ling pernil com pimenta", sem marca) | |
| Não encontrados | 2 | |
| Campo de ingredientes preenchido | 45 | |
| **Ingredientes utilizáveis** | **44** (1 campo tinha "price 4.50") | 34,7–53,8% |
| Ingredientes em português | 41 | |
| Declaração de alergênicos no texto ("ALÉRGICOS:" ou "pode conter") | 8 | 4,1–15,0% |
| Tags de alergênicos ou traços (calculadas pelo OFF) | 26 | |
| Declaração de glúten no texto | 14 | |
| Foto de ingredientes disponível | 43 | |
| Marcados como incompletos pelo próprio OFF | 54 de 98 encontrados | |
| Mais de 3 anos sem atualização | 0 de 98 (mediana 0,63 ano; máximo 2,03) | |
| Contradição de glúten detectada automaticamente | 0 de 44 | |
| Divergência de tamanho (mesmo GTIN) | 1 (batata palha: OFF 120 g × varejo 100 g) | |
| Erro HTTP final na leitura de produto | 0 de 100 | |
| Tempo de resposta (subamostra de 20) | mediana 554 ms · p90 947 ms | |
| Busca por nome: produto certo no top 5 | 2 de 20 | |
| Busca antiga `/cgi/search.pl` | 503 em todas as tentativas; abandonada | |

**Ingredientes por grupo (de 10):** bebidas 7 · massas e farinhas 6 · congelados 6 · laticínios 5 · carnes processadas 5 · grãos 4 · biscoitos e salgadinhos 3 · molhos e temperos 2 · outros 2 · doces e chocolates 1.

**Estados do motor com dados do OFF (44 produtos com ingredientes):**
- APLV: 15 incompatíveis, 28 com informação insuficiente, 1 não identificado.
- Celíaca: 18 incompatíveis, 24 com informação insuficiente, 2 não identificados.

## Comparação manual com rótulos (7 produtos)

As fotos vieram do próprio OFF, enviadas por colaboradores e vistas em resolução cheia. Não é a embalagem na mão. O detalhe por item está em `evidencias/piloto-off/comparacao-rotulos.json`.

| Produto | Ingredientes | Alergênicos no OFF × foto | App (APLV) | Pelo rótulo (APLV) |
|---|---|---|---|---|
| Creme de Leite Piracanjuba | conferem | iguais | incompatível | incompatível |
| Batata Palha Yoki | conferem | só "não contém glúten" nos dois | insuficiente | sem bloco ALÉRGICOS |
| Ketchup Hellmann's | conferem | só "não contém glúten" nos dois | insuficiente | sem bloco ALÉRGICOS |
| Torrada Bauducco | conferem | **OFF omitiu** "pode conter … leite e ovos" | insuficiente | possível contaminação |
| Nuggets Sadia | conferem | **OFF omitiu** "pode conter … leite e ovo" | insuficiente | possível contaminação |
| M&M's pote | **campo com lixo** | foto: contém leite, soja e glúten | sem análise | incompatível |
| Salsicha Seara | conferem | foto é print de site, fora do recorte | não identificado | não verificável |

Resumo: os ingredientes conferem em 6 de 7. A declaração de alergênicos sumiu no OFF em 2 de 7, e 1 campo tinha lixo. **Em nenhum caso** o app deu "não identificado" contra um risco visível na foto [CERTEZA para estes 7; n pequeno, não generaliza].

O único "não identificado" de APLV no conjunto todo é a salsicha. A foto dela é um print de site, então o resultado se apoia em evidência fraca. Isso reforça o ajuste 1 abaixo.

## Erro meu, corrigido durante o piloto

A primeira versão do `analisar.py` cometia dois erros:
- Contava "não contém glúten" como advertência de alergênicos. Essa frase é a declaração da Lei 10.674, não a da RDC 26/2015. Com isso, marcava "advertências completas" e gerou 7 "não identificado" para APLV.
- Aceitava "price 4.50" como lista de ingredientes.

Corrigi os dois. Os números acima são da versão corrigida, e o script reproduz exatamente o mesmo resultado a partir dos dados brutos. A lição vale para a integração: **o mapeamento do OFF para o motor nunca pode deduzir "advertências completas"**.

## Licença (ODbL) e compatibilidade

- A base está sob ODbL, o conteúdo individual sob DbCL e as imagens sob CC BY-SA. O próprio OFF diz que não garante exatidão nem completude.
- **No app:** mostrar "Dados: Open Food Facts (ODbL)" onde o dado aparecer e guardar a fonte e a data por item.
- **Share-alike:** se o Elida Público publicar uma base derivada que misture o OFF com outras fontes, essa base precisa sair sob ODbL. Só dá para combinar com fontes que permitam essa redistribuição. Fontes pagas com termos restritivos, como o Cosmos (não ativado), ficam separadas e nunca se fundem numa base única [PROVÁVEL; revisão jurídica antes do Público].
- **Fotos:** não foram copiadas para o repositório; só os links. Fotos de usuários do Elida nunca vão para o OFF.
- **Repositório público:** os JSONs brutos do OFF não foram para o GitHub. Estão no Drive privado, com atribuição. Os nomes de produto da amostra vêm de um repositório de terceiros com licença não verificada [SUPOSIÇÃO: risco baixo, são só nomes de produto].

## Identificação da aplicação

- A documentação pede User-Agent `AppName/Version (ContactEmail)`. A referência da API v3 aceita "URL or contact info". O piloto usou a URL, o que é aceitável. Para o app real, falta **um e-mail de contato** e **criar a conta do app no OFF e preencher o formulário de uso da API** (grátis). Os dois dependem do Kaleb.
- **Navegador:** um PWA não controla o User-Agent de forma confiável [PROVÁVEL]. Há duas saídas, e as duas precisam de aprovação:
  - (a) parâmetros `app_name` e `app_version` na URL; a documentação os cita para escrita, então falta confirmar se valem para leitura;
  - (b) um proxy próprio gratuito que adicione o User-Agent e faça cache. É infraestrutura nova.
- As chamadas saem do celular de cada pessoa, e por isso o limite conta por usuário. Uma família fica muito abaixo de 15/min.

## Riscos e limitações

1. **Viés da amostra:** a base de varejo é dominada por marcas nacionais grandes. A cobertura na cesta real, com marcas regionais e próprias, tende a ser menor [PROVÁVEL].
2. **"Atualizado" não quer dizer "conferido":** a data de modificação inclui edições automáticas [PROVÁVEL]. A idade da foto do rótulo não foi medida.
3. **84 identificações são heurísticas:** nome, marca e tamanho batem, mas não houve conferência com foto ou embalagem.
4. **Tempo de resposta:** medido em 20 requisições, a partir de um servidor em nuvem e não de um celular no Brasil.
5. **Registro da 1ª coleta perdido:** o registro de tentativas se perdeu quando interrompi o processo na fase da busca antiga. Os 100 GTINs têm resposta válida, mas não sei quantas retentativas houve ali. A subamostra de 20 tem registro completo: 0 erros e 0 retentativas.
6. **Comparação de rótulos:** só 7 itens, com fotos de colaboradores (podem ser de embalagem antiga), e 1 delas é print de site.
7. **Busca por nome:** não serve para identificar automaticamente (2 de 20).
8. **Dados colaborativos:** podem mudar, ter erro ou sofrer vandalismo a qualquer momento.

## Ajustes antes de integrar (aguardam aprovação)

1. **Dado do OFF entra como rascunho:** `ingredientesCompletos=false` e `advertenciasCompletas=false` até a pessoa marcar "conferi com a embalagem". Assim o app nunca mostra "não identificado" com base só no OFF.
2. **Transparência na tela:** mostrar a fonte, a data e o aviso "dado colaborativo, pode estar errado".
3. **Busca por nome:** só como sugestões, nunca como vínculo automático.
4. **Fila por aparelho:**
   - no máximo 12 leituras e 8 buscas por minuto;
   - espera progressiva em 429 e 503;
   - cache local por GTIN, com data;
   - nada em lote.
5. **Atribuição ODbL visível.**
6. **Identificação do app:** e-mail de contato, conta no OFF e escolha entre parâmetro na URL ou proxy gratuito.
7. **Repetir o piloto com 30 a 50 GTINs da cesta real da casa:** só os códigos de barras, sem perfil. Como usa dado de compra da família, **precisa da sua autorização**.

## Arquivos

- Código: `tools/piloto-off/` (`coletar.py`, `coletar2.py`, `analisar.py`, `amostra.json`, `revisao-manual.json`).
- Evidências: `docs/elida-ia/evidencias/piloto-off/` (`metricas.json`, `resultados-por-gtin.csv`, `coleta.json`, `comparacao-rotulos.json`).
- Dados brutos do OFF (100 JSONs, ODbL): somente no Drive privado.

Fontes: [documentação da API do OFF](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) · [referência v3, produto por código](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/) · [condições de uso da API](https://forum.openfoodfacts.org/t/conditions-to-use-the-open-food-facts-api/443)
