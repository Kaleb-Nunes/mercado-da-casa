# Elida — Auditoria de cibersegurança e contenção (branch de revisão)

Data: 2026-11-19. Escopo: `security/elida-acesso-familiar-20261119` criada a partir de `feature/perfis-inteligentes-rotulos`.
**Não foi feito merge em main, deploy, ativação de Firebase ou alteração de dados familiares.**

## Risco crítico identificado
As regras anteriores liberavam leitura/escrita a qualquer usuário com `request.auth != null` que conhecesse o identificador de uma casa. Uma sessão Firebase **anônima** satisfaz esse teste. O ID da casa é um identificador, **não** um certificado de autorização.

A configuração padrão do front-end mantinha `FB_CONFIG = null` e a sincronização não estava ativada. Isso não confirma quais regras foram efetivamente publicadas em um possível projeto Firebase: **verificar o console antes de usar o serviço**.

## Contenção aplicada nesta branch
1. `firestore.rules`: acesso aos dados limitado a `membros/{auth.uid}` **com `ativo == true`**, sob a casa solicitada. Nenhum cliente consegue criar/atualizar/deletar membros nem criar/atualizar casas. Listagem global e coleções não reconhecidas são negadas. A concessão e revogação de membros deverá ser feita por backend autenticado com Admin SDK.
2. `index.html`: `SYNC_FAMILIAR_ACL_HOMOLOGADA = false` impede habilitar o fluxo de sincronização antigo somente por injeção de configuração. Backup, compras e armazenamento local permanecem no navegador; **sincronização entre aparelhos deliberadamente indisponível** até reimplementação autorizada.
3. `sw.js`: cache offline limitado ao shell e arquivos estáticos públicos. `/api/`, outros endpoints, URLs com query, respostas marcadas private/no-store e recursos não reconhecidos não entram no cache do aplicativo. O leitor OCR continua com cache próprio de recursos estáticos.
4. `tests/rodar-seguranca.js`: testes estáticos das invariantes de acesso e execução simulada da política de interceptação do service worker; adicionados ao GitHub Actions.

## Importante: NÃO é solução completa de identidade
A versão atual **não possui cadastro de conta** nem backend seguro de convites. A nova política é fail-closed: bloqueia o compartilhamento atual até existir provisionamento confiável.

Para ativar sincronização com segurança, implementar e revisar:
- Firebase Auth com política de sessão, proteção contra abuso, recuperação/remoção e gerenciamento de titulares; não confundir autenticação anônima com permissão.
- Provisionamento de casas por serviço confiável, vínculo de UID verificado, convites **aleatórios, temporários, de uso único e revogáveis**; nunca dar acesso apenas pelo ID da casa.
- Papéis (proprietário/membro), remoção de membro e revogação efetiva, inclusive observando cache offline.
- Testes com **Firebase Emulator Suite**: desconhecido, anônimo sem vínculo, membro ativo, membro removido, links vazados, tentativas de alterar ACL, isolamento entre casas, limites de acesso e conflitos de escrita.
- Migração assistida dos usuários existentes, sem perda de dados; não publicar regras que bloqueiem famílias reais sem plano de transição.
- Auditoria adicional da telemetria, histórico do repositório, dependências, backups e provedores de API.

## Riscos residuais e controles pendentes
- **Dados de saúde e histórico financeiro no aparelho**: perfis e rótulos guardados em `localStorage`, acessíveis a outros usuários do mesmo perfil de navegador/dispositivo. Não há proteção com PIN nem criptografia específica do aplicativo. Exigir privacy-by-design, política de retenção, exclusão e proteção do dispositivo.
- **Backup em JSON sem criptografia**: dados sensíveis podem ser compartilhados acidentalmente. Planejar exportação cifrada com senha forte, confirmação da restauração e redução do escopo. NÃO pedir ao usuário para enviar backup com dados reais.
- **Homologação pública por link**: banner e `noindex` não equivalem a controle de acesso. Avaliar proteção de prévia, usar somente dados artificiais e nunca publicar perfis reais em ambientes de teste.
- **Git histórico antigo e artefatos**: confirmar em separado a remoção de dados pessoais anteriormente expostos, caches e suporte GitHub. Reescrita de histórico não reverte cópias já distribuídas.
- **Segurança alimentar**: OCR e OFF permanecem experimentais. Nenhuma aprovação clínica ou garantia de ausência de alergênicos.
- **PWA offline**: dados já presentes em caches antigos exigem validação de migração e limpeza no navegador real; nova política só atua quando o SW novo entrar em serviço.
- **Testes estáticos são insuficientes**: CI deste PR não substitui testes de regras no emulador, testes de sessão e pentest controlado.
- **Sem avaliação completa**: não foram executados scan de dependências/SCA, DAST, análise formal de CSP e headers, pentest de backend nem teste em aparelhos físicos reais neste PR.

## Plano de aprovação (gates)
1. PR draft com revisão do diff e CI verde.
2. Executar testes Firestore em emulador antes de reabilitar qualquer sincronização.
3. Confirmar que nenhuma regra Firebase foi aplicada em produção sem aprovação.
4. Testar PWA, backup e atualização em Android/iPhone com dados fictícios, inclusive cache legado.
5. Revisar regras e convites com responsável técnico; criar plano de rollback que **não restaure dados expostos**.
6. Autorização EXPRESSA do proprietário para merge/deploy; **este PR, por si só, não concede aprovação de lançamento público**.
