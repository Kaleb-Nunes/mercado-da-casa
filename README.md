# Elida

App de bolso pra controlar a comida da casa: preços do mercado, lista de compras, balanço do mês e lembretes da dieta (editável, com uma lista base sem leite).

Antes se chamava Despensa. As chaves internas de armazenamento continuam com o nome antigo (`despensa-…`, `mercado-casa-v1`) para ninguém perder dados.

Abrir: https://kaleb-nunes.github.io/mercado-da-casa/

- iPhone: Safari → Compartilhar → Adicionar à Tela de Início.
- Android: Chrome → ⋮ → Adicionar à tela inicial (ou Instalar app).
- Funciona sem internet depois da primeira abertura.
- Os dados ficam no próprio celular. Use **Fazer backup** uma vez por mês (as fotos dos produtos não entram no backup).

## Marca

Símbolo: um pote de despensa com uma folha dentro, tampa em latão. Cores: Verde #0F3B2E, Latão #D9B45A, Creme #F4F1E6, Tinta #10261F, Névoa #F1F3EF. Tipos: Fraunces (títulos e valores) e Onest (textos), servidas pelo próprio app em `fonts/` (licença SIL OFL), sem pedir nada ao Google.
Arquivos em `marca/`: símbolo, `wordmark.svg`, `logo-horizontal*.svg` e os PNG `elida-*` (logo, logo escuro, símbolo e manual da marca), todos com o nome Elida. O nome foi desenhado com Fraunces 600 (licença SIL OFL) convertida em curvas, sem depender da fonte instalada.

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

Preço de oferta por produto também entra por código, igual ao cupom: foto do encarte → Claude lê → `tools/gerar_ofertas.py encarte.json` gera a mensagem com `#ofertas=...`. No app, cada oferta aparece comparada com o último preço pago, marcada com "evitar" se tiver um termo da dieta, e o botão **+ Lista** põe o item na lista com o preço da oferta. Ao finalizar a compra no mesmo mercado da oferta, o preço guardado é o da oferta.

## Tempo real (Firebase)

Dois ou mais celulares na mesma "casa": o que um anota, os outros veem em segundos. Sem sinal, fica guardado no celular e sobe quando a internet volta.

- Banco: Cloud Firestore, plano grátis (Spark), login anônimo. Cada casa tem um id aleatório de 27 caracteres que vai no link do convite (`#casa=...`).
- Dados: `casas/{id}/itens`, `gastos`, `meses`, `config` (dieta, geral), `ofertas`, `membros`. Só os campos que mudaram são enviados, então duas pessoas mexendo no mesmo item em coisas diferentes (preço e carrinho, por exemplo) não se atropelam.
- Regras de segurança: `firestore.rules` (ninguém lista as casas; sem login, nada).
- SDK: `vendor/firebase.js` (Firebase JS 13.4.0, gerado de `tools/firebase-entry.js` com esbuild), servido daqui e guardado no cache offline.
- Ligar: preencher `FB_CONFIG` no `index.html` com o `firebaseConfig` do projeto. Enquanto estiver `null`, o tempo real fica escondido e o app funciona como antes.
- Entrar numa casa: Android toca no link; iPhone abre o app pela tela de início, toca em **Tenho um convite** e cola a mensagem (o iPhone guarda Safari e tela de início separados).
- Se o mesmo item estiver nos dois celulares na hora de entrar, vale o da casa. O que só existia no celular de quem entrou vai junto.

Criar o projeto (10 min): console.firebase.google.com → Criar projeto → Authentication → Anônimo → Ativar → Firestore Database → Criar (southamerica-east1, modo produção) → Regras: colar `firestore.rules` → Publicar → Configurações do projeto → Seus apps → Web → copiar o `firebaseConfig`.

## Dieta: três avisos

O motor fica em `dieta.js`, separado da interface, e é o mesmo código que os testes usam.

- **evitar**: o nome do item tem um termo da lista da dieta.
- **conferir** (informação insuficiente): o padrão de todo item. Só pelo nome não dá para saber.
- **conferido**: alguém da casa leu o rótulo e marcou no item. Vale 180 dias ou até o nome mudar. Nunca tira um "evitar". Fórmula infantil, granel e frios fatiados na hora não podem ser marcados.

A lista base "sem leite" (versão em `MODELO_SEM_LEITE`) **ainda não foi revisada por profissional de saúde**. Os avisos são lembrete da orientação médica; o app não diz se um alimento é seguro.

Instalação nova começa sem dieta. Quem já usava a versão anterior passa para a lista base automaticamente, sem perder o que escreveu; a lista antiga fica guardada e dá para voltar a ela pela tela Editar dieta.

## Testes

`node tests/rodar-testes.js` (sem dependências). Roda:
- a bateria de 130 casos da auditoria e 40 de controle (`tests/casos-alimentares.js`). A classificação de referência é **provisória e depende de revisão profissional**;
- conferência de rótulo, regressão dos 33 termos antigos, migração da dieta antiga;
- privacidade: nenhuma chave de nota fiscal (44 dígitos) nem CPF nos arquivos. Termos privados extras: variável `PRIVACIDADE_TERMOS` (segredo no GitHub, separado por vírgula) ou arquivo `.privacidade-local` (fora do Git);
- Firebase de produção desligado e chaves de armazenamento separadas por ambiente.

O GitHub Actions roda os testes a cada push e em todo pull request (`.github/workflows/testes.yml`) e guarda o pacote de homologação como artefato por 14 dias.

## Homologação

Produção é só `https://kaleb-nunes.github.io/mercado-da-casa/`. Em qualquer outro endereço o app entra em homologação:
- faixa "Homologação" no topo;
- dados com prefixo `hml:`, separados dos dados da família mesmo no mesmo navegador;
- Firebase de produção bloqueado (só emulador `demo-…` ou `FB_CONFIG_HML`, um projeto só de teste);
- cache offline com outro nome.

Prévia no computador: `sh tools/previa-local.sh` e abrir http://localhost:8080.

Fluxo: o Claude trabalha numa branch `claude/…`, abre pull request com o resultado dos testes, e só o fundador aprova o que vai para o `main` (que publica).
