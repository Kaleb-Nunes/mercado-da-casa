# Elida IA · Marco 2: integração ao app e busca com dados fictícios

Data: 19/11/2026 · Branch `feature/perfis-inteligentes-rotulos` · Só homologação.

## O que mudou
- **Navegação:** a aba Dieta ganhou três seções, "Avisos da lista", "Perfis" e "Rótulos" (`#rotulo`, `#perfis`, `#rotulos`). A página separada `perfis.html` foi removida.
- **Perfis:** ficam na mesma origem do app (`PFX + "elida-perfis-v1"`), sem depender de localStorage compartilhado entre subdomínios. Só são guardados com consentimento. A pessoa escolhe o perfil ativo, edita e exclui com dois toques. Os perfis entram no backup em arquivo (só se ela consentiu), e a prévia da restauração mostra quantos são. Desfazer a restauração também traz os perfis de volta.
- **Busca (`elida-busca.js`):** contrato v1 com `porNome`, `porCodigo` (GTIN com dígito verificador) e `porFoto`. Os status possíveis são `ok`, `nao_encontrado`, `indisponivel`, `invalido` e `nao_implementado`. Há tempo limite, produto fora do contrato é descartado, e todo produto traz fonte (provedor, identificação, data, licença e a marca `ficticio`).
- **Dados fictícios:** catálogo determinístico com 10 produtos e códigos de barras de uso interno (200…). Só existe na homologação; em produção a busca responde "indisponível".
- **Perfil aplicado sem ação extra:** cada resultado é avaliado com o perfil ativo na hora de aparecer na tela. Trocar ou editar o perfil reavalia tudo pelos gatilhos.
- **Foto:** só existe o contrato. O botão explica que a função ainda não existe e que vai exigir confirmação humana do texto lido.
- **Conferir rótulo digitado:** o formulário do Marco 1 agora abre numa folha dentro do app.
- **Pôr na lista:** leva o produto encontrado para a lista de compras. Os avisos de nome do DietaMotor continuam valendo.
- O service worker passou para a v8 e guarda os módulos novos para uso offline.

## Testes (19/11)
| Suíte | Resultado |
|---|---|
| `rodar-regras.js` | 99/99 |
| `rodar-busca.js` (contrato e catálogo fictício) | 31/31 |
| `rodar-testes.js` (Elida Familiar) | Sem falha crítica |
| Fluxo integrado (Chrome e Safari) | Todos os fluxos aprovados. axe: 0 violações em Perfis, Rótulos e nas folhas |
| Backup e acessibilidade das telas antigas | Ida e volta idêntica. axe: 0 |
| Percurso em 5 aparelhos e produção simulada | 0 erros, 0 pedidos externos, dados preservados |
| Atualização e offline (v6→v8) | Dados preservados, abre offline, fontes offline |
| Leitor de tela real e celular físico | **Não testado** |

## Pendências
- Fonte real de rótulos: decisão de fornecedor (até duas opções com custo e termos de uso) antes de qualquer integração.
- Foto e OCR (Marco 3): custo, privacidade e confirmação humana.
- Revisão profissional das listas de termos (requisito para o público).
