# Proposta: backend intermediário para o Open Food Facts

Status: **proposta, nada criado**. Precisa da sua aprovação antes de qualquer conta, deploy ou integração permanente.

## Por que

- **Identificação:** o OFF pede User-Agent `AppName/Version (ContactEmail)`, e o navegador não deixa o PWA definir esse cabeçalho. Hoje vão `app_name` e `app_version` na URL [PROVÁVEL que sirva para leitura; a documentação cita esses parâmetros para escrita].
- **Controle:** sem um ponto central não há cache compartilhado, limite global nem um jeito de desligar a integração sem publicar uma nova versão do app.

## O que ele faz (e só isso)

`GET /api/off/produto/{gtin}`. Nada de busca por nome no começo.

1. Aceita só GTIN-8, 12, 13 ou 14 com dígito verificador. Qualquer outra coisa recebe 400.
2. Aceita só a origem do Elida (homologação e, se aprovado, produção). O resto recebe 403.
3. Responde do cache se tiver (7 dias). Se não tiver, chama o OFF com `User-Agent: Elida/1.0 (e-mail de contato)` e os **campos fixos**, os mesmos de hoje.
4. Devolve só os campos que o app usa, com um tamanho máximo.
5. Limites:
   - por aparelho: 20 leituras/min;
   - global, para o OFF: no máximo 12/min; acima disso, 429 para o app;
   - depois de um 503 do OFF: pausa de 1 a 10 min.
6. Interruptor: uma variável de ambiente desliga tudo, e o app passa a responder "indisponível" na hora.

## Duas alternativas (até duas, como combinado)

| | A) Cloudflare Pages Function, no mesmo projeto da homologação | B) Deno Deploy |
|---|---|---|
| Custo | R$ 0 no plano Free: [100 mil requisições por dia e 10 ms de CPU por chamada](https://developers.cloudflare.com/workers/platform/pricing/), e passou do limite, para (não cobra) | R$ 0 no Free: [1 milhão de requisições por mês](https://deno.com/deploy/pricing?subhosting); o Pro custa US$ 20/mês |
| Se crescer | Workers Paid: [US$ 5/mês com 10 milhões de requisições, depois US$ 0,30 por milhão](https://developers.cloudflare.com/workers/platform/pricing/) | Pro US$ 20/mês |
| Mesma origem do app | **sim** (sem CORS, sem domínio novo) | não (precisa de CORS e de outro domínio) |
| Cache | Cache API, grátis | Deno KV (cota grátis) |
| Contador global | difícil sem Durable Objects [SUPOSIÇÃO: confirmar a cota do Free] | KV atômico |
| Conta nova | não (já existe) | sim |

**Recomendação: A.** Custo zero, sem conta nova, mesma origem, e no plano Free ele **para** em vez de cobrar.

## Segurança e prevenção de abuso

- Só GET, só o caminho acima e só GTIN válido. Não existe proxy aberto ("busque esta URL").
- Lista de origens permitidas.
- Limite por IP e limite global, com respostas pequenas.
- Sem chave no front-end, porque o OFF não usa chave. O e-mail fica no backend.
- Erros não ecoam a entrada.

## Privacidade

- O backend vê o IP e o GTIN. **Nunca** recebe perfil, restrição, foto ou dado familiar, e o contrato do app já garante isso.
- Sem log de IP nem de GTIN: o registro da plataforma fica desligado. A métrica guarda só contagens.
- Risco: com o backend, todas as consultas saem dos IPs da Cloudflare. Se o OFF limitar esses IPs, todo mundo sente junto. Mitigações: cache de 7 dias, limite global e o identificador do app com e-mail, para o OFF poder avisar antes de bloquear.

## Licença

- A resposta do OFF continua com a atribuição "Open Food Facts · ODbL".
- O cache **não** vira base própria misturada com outras fontes. Se um dia virar base derivada pública, ela precisa sair sob ODbL.

## O que preciso de você para seguir

1. Aprovar a alternativa A (ou B).
2. Um e-mail de contato para o User-Agent.
3. Criar a conta do app no OFF e preencher o formulário de uso da API (grátis).
