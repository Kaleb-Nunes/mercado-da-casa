# Marco 3: leitura de rótulo por foto, OFF como rascunho e várias restrições

Data: 19/11/2026 · Branch: `feature/perfis-inteligentes-rotulos` · Só homologação · Custo: R$ 0

## Verdade desconfortável primeiro

- **O leitor funciona bem em foto boa e falha em foto ruim.** De 17 fotos reais de listas de ingredientes, 14 passaram pela porta de qualidade e 3 foram barradas. As barradas eram a embalagem curva dos nuggets, a lasanha com o topo cortado e o sachê vermelho e enrugado. Nas que passaram, nenhum alergênico crítico se perdeu. Nas barradas, perderia: a dos nuggets deixava de fora "pode conter leite". Por isso a porta existe [CERTEZA nestas 20 fotos; n pequeno].
- **O tempo no celular não foi medido.** Medi em navegador de servidor: mediana de cerca de 1 s e máximo de 7 s quando precisa de três tentativas. Em Android médio deve ser de 2 a 5 vezes mais lento [SUPOSIÇÃO]. Só o teste no aparelho de vocês responde isso.
- **Na primeira vez, o celular baixa cerca de 5,4 MB.** Depois funciona offline.

## Arquitetura

```
código de barras ──► Open Food Facts (só homologação) ──► RASCUNHO ─┐
nome ──► OFF: só SUGESTÕES ──► "é este produto?" ──► código ──► RASCUNHO ─┤
foto ──► leitor local (Tesseract/WASM, no aparelho) ──► RASCUNHO ───────┤
                                                                       ▼
                         conferência humana obrigatória (texto + 3 marcações)
                                                                       ▼
            ElidaRegras m3: todas as restrições do perfil ativo, a pior primeiro
                                                                       ▼
        resultado + fonte + data + evidência + versão do motor e da política (guardado no aparelho)
```

- **Rascunho nunca é conclusão favorável.** O motor (`m3-2026.11.19`) trata `rascunho` como não conferido. Os sinais de alergênico do OFF entram como "contém" ou "pode conter", então só podem agravar o resultado. Testado com 6 restrições ao mesmo tempo em 4 produtos reais: nenhum "não identificado".
- **Várias restrições:** o estado geral é o pior entre elas, e a lista mostra primeiro a pior. Um "não identificado" para celíaca nunca aparece antes de uma incompatibilidade com APLV.
- **Foto:**
  - A imagem fica só na memória. Não é guardada e não sai do aparelho.
  - Os arquivos do leitor vêm do próprio site, de `vendor/ocr/`, sem CDN.
  - São até três leituras: luminância, canal azul e canal vermelho. A leitura para na primeira que passa.
  - A porta de qualidade exige confiança de pelo menos 60%, a palavra "Ingredientes" (com variações de OCR, inclusive "INGR.:") e uma lista não vazia. Se falhar, a resposta é INFORMAÇÃO INSUFICIENTE.
- **Conferência:** para foto e OFF, sem "Conferi este texto com a embalagem na minha mão" não há análise. Sem as marcações "lista completa" e "ALÉRGICOS e glúten completos", o resultado fica em INFORMAÇÃO INSUFICIENTE. Palavras de baixa confiança aparecem para revisão.
- **OFF:**
  - Fica desligado por padrão. É escolhido em "Fonte de teste" na tela Rótulos, que só existe em homologação.
  - Limites: no máximo 12 leituras e 8 buscas por minuto por aparelho.
  - Depois de 429 ou 503, espera de 30 s a 10 min. O cache dura 7 dias, com até 200 códigos.
  - As chamadas vão sem cookie e sem referrer. Só saem o código ou o termo digitado, mais `app_name` e `app_version`.
  - Em produção o provedor não é criado, e um segundo bloqueio no contrato exige `aprovadoProducao`.
- **Evidência:** cada análise conferida fica em "Rótulos conferidos neste aparelho", até 30. Guarda o texto do rótulo, a fonte, a data, o hash da evidência e as versões. Nada do perfil é guardado ali. Dá para reanalisar com o perfil atual, e o app avisa se as regras mudaram desde a conferência.

## Por que OCR local (Tesseract) e não outra coisa

| Opção | Privacidade | Offline | Custo | Situação |
|---|---|---|---|---|
| **Tesseract.js no navegador (escolhida)** | imagem não sai do aparelho | sim, depois da 1ª carga | R$ 0 | funciona hoje no PWA, em Android e iPhone |
| ML Kit (Android) e Apple Vision (iOS) no aparelho | não sai do aparelho | sim | R$ 0 de uso; exige app nativo (Capacitor) e contas de loja | mais rápido e preciso [PROVÁVEL]; depende de virar app de loja |
| OCR em nuvem (Google Vision, AWS Textract) | **a imagem vai para terceiro** | não | pago | descartado pelas regras atuais |
| API de detecção de texto do navegador | não sai | sim | R$ 0 | não existe no iPhone; descartado |

## Bancada com 20 fotos reais de rótulo

As fotos são de colaboradores do OFF, em CC BY-SA, e ficaram fora do repositório. O gabarito foi transcrito à mão, olhando cada foto. Rodei em Chromium e WebKit, e os dois motores deram o mesmo resultado porque o preparo da imagem é feito pixel a pixel.

| Medida | Resultado |
|---|---|
| Fotos de lista que passaram pela porta | 14/17 |
| Fotos sem lista (frente, só denominação, só bloco de alérgicos) barradas como insuficiente | 3/3 |
| Ingredientes lidos, entre as que passaram | 110/116 (Chromium) · 111/116 (WebKit) |
| "Contém" alergênico lido | 20/20 |
| "Pode conter" lido | 30/30 |
| Declaração de glúten correta | 11/12 (1 virou "não informado", o lado conservador) |
| "Não contém glúten" lido quando o rótulo diz "contém" | 0 |
| Alergênico crítico perdido numa foto que passou | **0** |
| Tempo (servidor; não é celular) | mediana 0,7–1,1 s · p90 2,9–3,5 s · máximo 7,3 s |
| Requisições para fora durante a leitura | 0 |

Detalhe por foto: `evidencias/marco3/pontuacao.json`. Gabarito: `evidencias/marco3/gabarito.json`.

A limitação do CPU 4x mais lento do Chromium não vale para o leitor: a limitação não pega o worker, então os números não representam celular [CERTEZA].

## Testes

- **Node, no CI (job `elida-ia`):**
  - regras: 104;
  - busca: 43 (13 novos do OFF com rede simulada: rascunho, nunca favorável, limite da 13ª chamada, 429/503, cache, sugestão sem ingredientes, produção desligada, só endereços do OFF no módulo);
  - OCR: 20 (ruído de OCR, porta de qualidade, conferência obrigatória, várias restrições, sem rede no módulo);
  - ambiente: 25;
  - regressão do app: 618 verificações, todas passando.
- **Ponta a ponta (Playwright, Pixel 7 Chromium e iPhone 13 WebKit), `evidencias/marco3/e2e*.json`:**
  - foto borrada dá INFORMAÇÃO INSUFICIENTE;
  - foto legível preenche os campos;
  - sem conferir, a análise fica bloqueada;
  - com APLV e celíaca: "pode conter leite" dá risco de contaminação, mesmo com celíaca em "não identificado";
  - a fonte, as versões e a evidência aparecem no resultado;
  - os rótulos conferidos são salvos sem dados do perfil;
  - a leitura funciona **offline** depois da 1ª carga, nos dois motores;
  - OFF com rede simulada: o rascunho nunca deu "não identificado", a busca por nome só sugere, "é este produto" busca pelo código, e as chamadas levam só o código e a identificação do app;
  - axe WCAG 2.2 AA: 0 violações em 6 telas novas, nos dois motores;
  - produção simulada: sem seletor de fonte, a busca responde "indisponível" e nenhuma chamada ao OFF sai, mesmo com a preferência "off" gravada.
- **Ao vivo (1 leitura real do OFF a partir do app):** HTTP 200 e CORS liberado (`*`). O produto apareceu como rascunho, com APLV incompatível. No teste WebKit, 1 leitura real escapou da rede simulada por causa do service worker. Ficou dentro do autorizado, e refiz esse teste sem service worker.

## Riscos e limites

1. Foto ruim (curva, reflexo, corte, fundo colorido) é barrada. Isso é intencional, mas vai frustrar quem usar. Na tela, a orientação é "de perto, com luz, sem reflexo".
2. Rótulo com o bloco ALÉRGICOS em outra face: a foto de uma face só deixa as advertências incompletas, e a pessoa precisa conferir a outra face. O app avisa quando não acha o bloco.
3. A conferência humana é o ponto que segura tudo. Se a pessoa marcar "conferi" sem conferir, o app confia. Isso não tem solução técnica completa.
4. O pacote do leitor ocupa 13 MB no repositório (3 variantes do núcleo). Cada aparelho baixa uma só.
5. Os rótulos conferidos ainda não entram no backup. É uma decisão sua.
6. Nada aqui é validação clínica.
