# Elida · Radar da casa (branch `feature/elida-uau-20261122`)

Entrega de 22/11/2026 para a apresentação a investidores. Só homologação. Nada foi mesclado na `main`, nada foi publicado em produção, nenhum serviço pago foi ativado, nenhum dado familiar real foi lido ou alterado.

## O que mudou, em uma tela

| Antes | Agora |
|---|---|
| Landing com texto e botões | Simulação real antes do cadastro: o visitante escolhe Biscoito, Pão ou Achocolatado, vê o rótulo "lido" e o veredito de cada pessoa da casa, liga e desliga perfis e alterna Antes/Agora para ver a fórmula mudar. Cabe na primeira tela do celular (390×844). |
| 7 abas | 4 destinos + botão central de escanear: **Radar**, **Família**, **Economia** (Lista, Preços, Ofertas, Gastos), **Nutri**. |
| Veredito de um perfil por vez | Veredito individual e da casa, com gravidade por pessoa: alergia ou doença, intolerância ou suspeita, preferência. Preferência nunca vira alerta vermelho. |
| Comparar dois rótulos à mão | Radar de mudança de fórmula: compara, para cada produto que a família já conferiu, a versão mais nova com a anterior e diz quem da casa piorou. |
| Nomes técnicos no rótulo | Nomes disfarçados explicados em linguagem simples (caseinato, soro de leite, malte, "pode conter"). |
| Consulta com a nutricionista em texto solto | Relatório de dúvidas e consumo: o usuário escolhe as seções, imprime, salva em PDF ou baixa um HTML sem script. O app não envia nada. |
| Código de barras sem exemplo | Em homologação, o painel de código mostra três códigos do catálogo fictício. |

Cor nunca é a única pista: todo estado tem ícone e texto. Verde quer dizer "Nada encontrado nos dados conferidos". O app nunca escreve "seguro".

## Honestidade técnica (leia antes de apresentar)

1. **Não está validado clinicamente.** A política de regras (`pol-2026.11.18`) segue pendente de revisão profissional. O relatório e o rodapé dizem isso. Não diga "validado", "seguro" nem "diagnóstico" na apresentação.
2. **O motor não modela anafilaxia.** A gravidade "alergia" muda a ordem e o tom da tela, não a regra. Contaminação cruzada aparece como "pode conter", como na embalagem.
3. **O Radar só enxerga o que a família conferiu no app.** Ele compara versão contra versão das embalagens guardadas. Não monitora o mercado e não descobre sozinho que um fabricante mudou a receita. Isso depende de base de rótulos (ver Open Food Facts, pendente de decisão do Kaleb).
4. **Os produtos da simulação e da demonstração são fictícios** e marcados como tal. Em produção o catálogo continua "indisponível" e os dados de demonstração não carregam (`AMB.homologacao`).
5. **Câmera de código de barras não foi verificada em aparelho real.** O Chromium de teste não tem `BarcodeDetector`. A digitação do número funciona e está testada.
6. **Preços**: nada foi inventado. Economia usa só o que o usuário anotou.

## Roteiro de 3 minutos

Abrir em celular (ou janela de 390 px) na URL de homologação da branch.

1. **0:00 · Landing.** Sem tocar em nada, o rótulo do Biscoito é "lido" e a casa aparece: três pessoas precisam evitar. Toque em **Antes** e depois em **Agora**: a fórmula mudou, entrou "soro de leite em pó" e um aviso de amendoim. Desligue o Théo e veja o veredito mudar. Frase: *"Quando o rótulo muda, o que vai para casa?"*
2. **0:50 · Radar.** Continuar como visitante, **Carregar família de demonstração**. Três alertas, o mais grave primeiro. Abrir o do biscoito: quem piorou, o que entrou, nome disfarçado explicado. **Levar à consulta** gera a pergunta pronta, sem enviar nada.
3. **1:30 · Família.** Quatro perfis, três níveis de cuidado. Mostrar que preferência é "só informativo".
4. **1:50 · Scanner.** Botão central, Código de barras, chip **Pão de forma**. Resultado por pessoa, marcado como fictício. Dizer que o código é o único dado que sairia do aparelho, e só na busca; o perfil nunca sai.
5. **2:15 · Nutri.** Exportar relatório, desmarcar uma seção, baixar o arquivo. Dizer: *"o app não envia nada, quem decide o que mostrar é a família"*.
6. **2:45 · Fechamento.** Economia no mesmo destino. Encerrar com o limite: *"Não somos laudo. Somos o que a família leva organizado para a consulta."*

Perguntas prováveis e resposta honesta:
- *"Como vocês sabem que o rótulo mudou?"* Hoje, comparando duas leituras da própria família. Escalar exige base de rótulos.
- *"Isso é validado?"* Não. Há uma política de regras em revisão profissional e nenhuma alegação clínica.
- *"Por que não usar Yuka ou Fig?"* Ver a seção seguinte: scanner com perfil não é diferencial sozinho.

## Concorrência (levantamento de 22/11/2026)

- **Yuka** anunciou chegada ao Brasil e ao México em 8/7/2026 e se declara com mais de 85 milhões de usuários; a nota é 60% Nutri-Score, 30% aditivos, 10% orgânico ([Pillitteri](https://pasqualepillitteri.it/en/news/16112/yuka-app-how-it-works-alternatives), [Correio](https://www.correio24horas.com.br/saude/aplicativo-que-revela-se-alimentos-e-cosmeticos-sao-bons-para-a-saude-chega-ao-brasil-0726)). Premium traz alertas personalizados. É nota de saúde, não veredito por pessoa com restrição.
- **Fig** faz perfil para cada pessoa e acha comida que serve para todos de uma vez; declara mais de 2.800 alergias e dietas ([App Store](https://apps.apple.com/app/id1564434726), [mwm.ai](https://mwm.ai/apps/id/1564434726)). Não confirmei disponibilidade no Brasil.
- **IngrediCheck** devolve Matched, Unmatched ou Uncertain e entende apelidos de ingredientes ([App Store](https://apps.apple.com/us/app/id6477521615)).
- **Desrotulando** (Brasil) dá nota de 0 a 100 pelo Guia Alimentar e declara mais de 4 milhões de usuários ([App Store BR](https://apps.apple.com/BR/app/id1071285904)). **Loomos** (Brasil) destaca ingredientes proibidos por alergia ou dieta pela câmera ([Canaltech](https://canaltech.com.br/apps/como-usar-loomos-reconhecer-alimentos/)).

Conclusão desconfortável: **escanear + perfil + apelidos de ingredientes já existe** e não é fosso. O que a demonstração mostra de diferente é a combinação: veredito da casa por gravidade, mudança de fórmula sobre as embalagens da própria família, relatório para a nutricionista e recusa deliberada de dizer "seguro". Isso é uma tese de produto, não uma prova de mercado.

## Evidência

| Verificação | Resultado |
|---|---|
| `tests/rodar-demo.js` (novo) | 37/37: gravidade, "nunca seguro", alertas e ordem, XSS escapado, relatório, sem rede/armazenamento nos módulos, demo só em homologação |
| `tests/rodar-regras.js` | 104/104 (1 falha herdada da base corrigida: o teste olhava `index.html`, o app mora em `elida-app.js`) |
| `tests/rodar-ambiente.js` | 25/25 (7 falhas herdadas corrigidas pelo mesmo motivo e pelo sandbox do service worker) |
| `tests/rodar-busca.js`, `rodar-ocr.js`, `rodar-seguranca.js`, `rodar-testes.js`, entradas não confiáveis, identidade e backup, aprovação, botões | todos verdes |
| `tests/browser-botoes.cjs` (atualizado para a nova navegação) | 16/16 no Chromium: OCR, comparação, jantar offline, consulta, PKCE, backup |
| `tests/browser-uau.cjs` (novo) | 11/11 no Chromium e 11/11 no WebKit |
| axe-core (WCAG 2.1 AA e boas práticas) | 0 violações em 20 telas, claro e escuro, 390 px |

## Arquivos

Novos: `elida-demo.js`, `elida-uau.js`, `elida-uau.css`, `elida-radar.js`, `elida-dossie.js`, `tests/rodar-demo.js`, `tests/browser-uau.cjs`.
Alterados: `index.html`, `elida-app.js`, `elida-entrada.js`, `elida-entrada.css`, `sw.js` (cache v29), workflows de CI (lista do pacote de homologação e testes novos), `tests/rodar-ambiente.js`, `tests/rodar-regras.js`, `tests/browser-botoes.cjs`.

Acessibilidade corrigida de passagem na base: a folha (`#sheet`) fechada ficava exposta sem nome; o app agora tem `h1` e landmark `header`.

## Fora do escopo desta entrega, por decisão dele

Merge na `main`, publicação da versão completa, serviços pagos, lançamento a famílias externas, alteração de dados reais, exclusão de branches ou backups. O Elida Familiar RC3 continua aguardando testes físicos e autorização expressa.

## Decisões que continuam abertas

1. Backend A ou B (proposta em `BACKEND-PROPOSTA.md`).
2. E-mail ou conta de contato para o Open Food Facts.
3. Segunda lista de códigos do piloto.
4. Se as conferências entram no backup.
