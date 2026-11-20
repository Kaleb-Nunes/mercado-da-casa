# Élida — preparação do Firebase familiar (HOMOLOGAÇÃO, sem deploy)

**Estado:** backend e regras preparados em uma branch de revisão. Nenhuma alteração na produção, nenhum Firebase real alterado, nenhuma sincronização ativada. A integração no navegador, a autenticação do usuário e a migração de dados ainda precisam ser implementadas e validadas.

## O que foi preparado

- Functions v2 (Node.js 22, região southamerica-east1) usando Firebase Admin SDK para criarCasa, criarConvite, aceitarConvite e revogarMembro.
- Acesso apenas com Firebase Authentication não anônimo, e-mail verificado e Firebase App Check.
- ID de casa aleatório de 20 bytes (base64url, 27 caracteres).
- Convite de 32 bytes aleatórios; somente SHA-256 do token é salvo na subcoleção privada de convites. O token é retornado uma única vez, para compartilhamento por canal privado, e nunca deve ser registrado em logs.
- Convites vinculados ao e-mail destinatário, duração de 24 horas e consumo único em transação.
- A casa e o primeiro membro (papel dono) são criados atomicamente; demais membros recebem papel membro.
- O titular pode revogar outros membros, nunca a si próprio por esta API.
- As regras do Firestore negam ao navegador a criação/edição de casas e membros; dados compartilhados são permitidos apenas para membro ativo; tokens de convites são inacessíveis ao cliente.
- O index.html continua com SYNC_FAMILIAR_ACL_HOMOLOGADA = false: não trocar até implementar login, convites, testes com duas contas reais e plano de migração.

## Impedimentos reais

1. Acesso administrativo autenticado ao projeto Firebase não está disponível nesta sessão; não foram verificados IAM, Auth, Firestore publicado, App Check, regras reais, usuários ou faturas.
2. FB_CONFIG e FB_CONFIG_HML continuam null. Não incluir credenciais privadas no repositório e não colar uma configuração de produção dentro da homologação.
3. As novas funções exigem plano Blaze para deploy, que envolve habilitar faturamento. Não habilitar sem autorização explícita e orçamento/alertas de gastos definidos. O emulador pode rodar sem Blaze.
4. O app ainda usa fluxo legado baseado em autenticação anônima e URL com ID da casa. Esse fluxo está bloqueado por segurança. É necessário criar no front-end login Google/e-mail, vínculo com Functions, convites por token, sem quebrar o modo visitante local.
5. O código de Functions não foi publicado nem testado contra autenticação e Firestore reais. Os testes unitários e do Firestore Emulator são parciais; a integração funcional completa ainda depende de implementação e QA.
6. Testar iPhone e Android físicos, modo offline, reconexão, reinstalação/atualização da PWA, persistência e backup antes de habilitar sincronização.

## Preparar somente ambiente local ou de homologação

- Instalar Node.js 22 e Firebase CLI.
- Na raiz do repositório executar: npm --prefix functions install; npm --prefix functions test.
- Testar regras exclusivamente com emulador: npx firebase emulators:exec --only firestore --project demo-elida-acl "node tests/emulator-acesso.cjs".
- Testar funções com emuladores Firestore + Auth + Functions, com contas e dados fictícios, após instalar as dependências. Nunca apontar emuladores para dados reais.
- No projeto Firebase exclusivo de homologação criar app Web, habilitar Auth Google e e-mail/senha com verificação de e-mail, registrar domínios autorizados, criar Firestore na região escolhida e configurar App Check.
- Configurar no cliente somente os parâmetros Web públicos (apiKey, authDomain, projectId, appId); as permissões dependem da identidade, App Check, backend e regras, não do sigilo da apiKey.
- Nunca salvar JSON de conta de serviço, private keys ou refresh tokens no repositório. Usar credenciais gerenciadas pelo runtime Firebase.

## Contrato do backend (Firebase Functions SDK)

Região: southamerica-east1. Todas as operações exigem login verificado e App Check.

| Callable | Parâmetros | Resposta |
|---|---|---|
| criarCasa | nome, pessoa | casaId, nome |
| criarConvite | casaId, email | casaId, token, expiraEm |
| aceitarConvite | casaId, token, pessoa | casaId, nome |
| revogarMembro | casaId, uid | revogado: true |

O frontend deve chamar httpsCallable(getFunctions(app, "southamerica-east1"), "nomeDaFuncao"). Ao aceitar convite, o usuário deve estar logado com e-mail verificado correspondente. Nunca usar a URL legada baseada só no ID da casa como autorização. O token do convite poderá viajar somente pelo fragmento de URL, que precisa ser removido do histórico antes de registrar telemetria ou abrir links externos.

## Critérios mínimos de liberação

- Verificar acesso autenticado ao projeto e comparar regras publicadas com a branch.
- Reproduzir no emulador: sem login, anônimo, e-mail não verificado, dono, convidado certo, e-mail errado, token expirado/usado, membro revogado e duas casas.
- Confirmar isolamento de famílias e ausência de escalada de privilégios pelo cliente.
- Conferir App Check, limites de gasto e alertas.
- Conferir integração do app, backup restaurável e migração sem perda nem duplicação de dados.
- Aprovação expressa antes de merge, deploy, ativação e gastos.

**Nota:** um MVP totalmente gratuito no plano Spark exigiria outra solução de convites sem Cloud Functions. Este pacote não assume que Spark permite deploy.
