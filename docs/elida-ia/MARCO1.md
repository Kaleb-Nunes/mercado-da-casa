# Elida IA · Marco 1: relatório técnico

Data: 18/11/2026 · Branch `feature/perfis-inteligentes-rotulos`, criada a partir de `8f43883` (RC2 do Elida Familiar) · Só homologação.

## 1. Auditoria do protótipo (Elida_IA_Starter v0.1)

O SHA-256 do ZIP confere com o arquivo de integridade (`6d81f23b…`). Os 29 testes do protótipo passam. Os achados abaixo já estão corrigidos em `elida-regras.js`:

| Prioridade | Achado no protótipo | Efeito | Correção |
|---|---|---|---|
| P0 | APLV: com "lactose" nos ingredientes, o resultado era "insuficiente" antes de olhar o leite | "leite integral, lactose" dava INSUFICIENTE em vez de INCOMPATÍVEL | O leite é checado primeiro. Lactose sozinha pede orientação profissional |
| P0 | Advertências comparadas por palavra exata (`contem.includes('leite')`) | "derivados de leite" ou "CONTÉM LEITE E DERIVADOS DE TRIGO" não eram reconhecidos. Com rótulo completo, o resultado podia ser favorável | Busca por termo dentro do texto, em lista ou texto corrido |
| P0 | Termos de leite incompletos | manteiga, queijo, requeijão, iogurte, nata, coalhada, composto lácteo e ghee não eram pegos | Lista ampliada, com exclusões explícitas: manteiga de cacau, leites vegetais |
| P0 | Glúten sem malte (só "malte de cevada"), sem aveia, espelta e semolina | Falso negativo para celíacos | Lista ampliada. "não contém glúten" escrito nos ingredientes não vira alerta falso |
| P1 | A idade da fonte não era verificada | Fonte de anos atrás tinha o mesmo peso de uma recente | Mais de 365 dias, data no futuro ou data inválida dão INSUFICIENTE |
| P1 | O "pode conter" também era comparado por palavra exata | "pode conter cevada" não era reconhecido | Mesma busca por termo |
| P1 | Gatilhos só traduziam nome em ação | Não havia proteção contra loop, chamada de rede ou nomes como `constructor` | Lista fechada, bloqueio de gatilho dentro de gatilho, ações de rede bloqueadas no Marco 1 |
| P2 | O carimbo de data e hora não era determinístico | Testes instáveis | Parâmetro `agora` |
| P2 | `demo-formulario.html` não foi aproveitado | — | Substituído por `perfis.html`, acessível e ligado ao motor |

## 2. Convivência com o app atual

- O `dieta.js` (DietaMotor) não foi tocado. Ele continua cuidando dos avisos **pelo nome** na lista.
- O `elida-regras.js` (motor novo) só recebe **dados do rótulo**: ingredientes, advertências, declarações e fonte. O nome comercial nunca decide.
- O `index.html` **não** carrega o motor novo neste marco (há um teste que garante isso). As chaves da Despensa (`mercado-casa-v1` etc.) não mudaram.
- A página nova `perfis.html` usa a chave própria `hml:elida-perfis-v1`.

## 3. O que foi entregue

| Arquivo | Conteúdo |
|---|---|
| `elida-regras.js` | Motor de regras, esquema do formulário, campos condicionais, gatilhos e armazenamento com consentimento. É um módulo único, que funciona no navegador e no Node |
| `perfis.html` | Formulário acessível com vários perfis, perfil ativo, edição, exclusão, exportação e conferência de rótulo digitado |
| `tests/rodar-regras.js` | 98 testes: os 29 do protótipo, os casos da auditoria, formulário, gatilhos, armazenamento e convivência com o app |
| `.github/workflows/testes.yml` | Job separado `elida-ia`, com relatório próprio. O job do Elida Familiar não mudou |

**Estados:** INCOMPATIVEL_IDENTIFICADO, POSSIVEL_CONTAMINACAO, REQUER_ORIENTACAO_PROFISSIONAL, INFORMACAO_INSUFICIENTE, NAO_IDENTIFICADO_NOS_DADOS_VERIFICADOS e INFORMATIVO (só para glicose). Não existe estado "SEGURO". Cada restrição tem o seu resultado, e o geral é sempre o mais grave entre elas.

**Perfil:** apelido, faixa etária (opcional), restrições e a situação de cada uma (confirmada, suspeita, orientação profissional ou preferência), além de versão. Não pede CPF, data de nascimento nem diagnóstico em texto livre. Apelido com 8 dígitos ou mais seguidos é recusado.

**Armazenamento:** sem consentimento, os perfis ficam só na memória da página. Desmarcar o consentimento apaga o que estava salvo. Dá para exportar (JSON), excluir um perfil e excluir tudo. Dados corrompidos viram estado vazio.

**Resultado válido:** um resultado vale para um perfil e um rótulo específicos (por resumo das evidências). Se o rótulo ou a restrição mudarem, o resultado antigo é marcado como desatualizado. A situação "preferência" nunca afrouxa um alerta.

**Auditoria:** registra versões, resumo das evidências, estado geral e número de restrições. Não guarda apelido, restrições nem ingredientes.

## 4. Testes executados

| Teste | Resultado |
|---|---|
| `node tests/rodar-regras.js` | 98 aprovados, 0 falhas |
| `node tests/rodar-testes.js` (Elida Familiar) | Sem falha crítica |
| `perfis.html` no Chrome (Pixel 7) e no Safari (WebKit, iPhone 13) | Erros de campo, situação condicional, avisos condicionais, sem consentimento nada salvo, com consentimento persiste, vários perfis, análise por restrição, rótulo alterado marca resultado antigo, restrição alterada invalida, excluir e apagar tudo: tudo aprovado |
| axe-core (WCAG 2.2 AA) em `perfis.html`: estado inicial, com erros e com resultado | 0 violações nos dois motores |
| Rede | 0 pedidos a outros sites. A URL nunca leva dados de saúde |
| Leitor de tela real (VoiceOver, TalkBack), baixa conectividade e celular físico | **Não testado** |
| Rótulos reais revisados por profissional | **Não testado** (não há bateria revisada) |

## 5. Riscos residuais

1. **A política alimentar não tem revisão profissional.** As listas de termos são conservadoras, mas não estão validadas. Isso bloqueia o uso público.
2. **Rótulo digitado:** erro de digitação ou cópia incompleta gera resultado errado. A mitigação é a pessoa marcar explicitamente "copiei tudo"; sem isso, o resultado é INSUFICIENTE.
3. **O termo "leite" é amplo:** um produto vegetal com nome fora da lista de exclusões ("bebida de castanha com leite de...") pode dar alerta a mais. Isso é aceitável, porque o erro vai para o lado conservador.
4. **Óleo de soja e lecitina:** contam como soja. É conservador e pode divergir da regra de rotulagem para óleo refinado.
5. **Aveia conta como glúten para celíacos.** É conservador; a aveia pura certificada é uma decisão profissional.
6. **O consentimento é local e simples.** Para o Elida Público, falta um texto revisado por advogado (LGPD, dado de saúde de criança, ECA Digital).

## 6. Próximo passo (Marco 2, aguardando sua confirmação)

Adaptador de busca por nome e por código de barras, **com mocks determinísticos**, e contrato de fonte (origem, data, completude e licença). Antes de usar qualquer fornecedor real, apresento até duas alternativas com custo e termos de uso.

**Custo do Marco 1: R$ 0.** Não há API, banco de dados nem serviço pago.
