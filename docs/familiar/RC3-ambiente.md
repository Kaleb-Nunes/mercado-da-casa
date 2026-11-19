# Elida Familiar · RC3: correção de ambiente (antes/depois do RC2)

Data: 19/11/2026 · Branch `homologacao` (RC2 `8f43883` → RC3) · Sem nenhuma funcionalidade do Elida IA.

| | RC2 (`8f43883`) | RC3 |
|---|---|---|
| Como decide o ambiente | Domínio fixo no código: só `kaleb-nunes.github.io/mercado-da-casa/` era produção; todo o resto era homologação | `ambiente.js`: só a lista de homologação (`elida-homologacao.pages.dev`, `*.elida-homologacao.pages.dev`, `localhost`, `127.0.0.1`) é homologação; todo o resto é produção |
| Num domínio próprio no futuro | Viraria **homologação**: faixa de teste, dados de teste e chaves `hml:`, ou seja, os dados reais da família não seriam lidos | **Produção**: mesmas chaves de hoje, sem faixa nem dados de teste |
| Configuração quebrada ou script não carrega | Não se aplicava | Produção (o caminho seguro) |
| Service worker | Detecção própria, duplicada | Mesma decisão do app (`importScripts("./ambiente.js")`), cache `despensa-v8` |
| Teste de atualização no endereço `teste-atualizacao` | Exigia trocar as constantes no código | Já previsto na configuração (`forcarProducao`) |

## Testes do RC3
- `rodar-ambiente.js`: 25/25. Inclui domínio próprio, sufixo falso, falta de https e o service worker em cada endereço.
- `rodar-testes.js`: sem falha crítica.
- Backup e acessibilidade (Chrome e Safari): ida e volta idêntica, axe com 0 violações.
- Percurso em 5 aparelhos: 0 erros, 0 pedidos externos. Produção simulada (Chrome e Safari): dados preservados e sem faixa.
- Atualização v6→v8 com produção simulada pela configuração: dados preservados, cache antigo removido, abre offline.
- Domínio próprio simulado: produção, chaves sem prefixo e sem dados de teste. Endereço de homologação: homologação.
