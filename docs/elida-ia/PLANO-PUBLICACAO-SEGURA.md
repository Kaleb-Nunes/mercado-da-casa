# ELIDA IA — Portões de homologação e implantação segura (20/11/2026)

**Estado atual:** homologação isolada na branch `feature/elida-ia-auth-backup-seguro-20261120`; configuração pública do Firebase Web incorporada, sem merge nem deploy da versão atual. Sincronização familiar bloqueada e regras do Firestore real não publicadas.

## Atualização verificada em 20/11/2026 — cadastro Firebase Web

- O usuário registrou o aplicativo **Elida Web** no Console do projeto `projeto-elida-aplv` e forneceu a configuração **pública** do SDK Web.
- `elida-firebase-config.js` agora contém os quatro parâmetros públicos oficiais (`apiKey`, `authDomain`, `projectId`, `appId`), somente para os hosts de homologação permitidos. Em produção o objeto permanece `null`.
- O Google Analytics **não foi incluído** no aplicativo; `measurementId` não é utilizado.
- As ferramentas de testes não verificaram login OAuth no navegador real. Configurar **Authentication > Configurações > Domínios autorizados** com os endereços de homologação exatos antes dos testes em celular. Não usar curingas, nem cadastrar hospedagem desconhecida.
- O app de homologação usa credenciais de Authentication do projeto real para login, mas **não acessa Firestore** e não compartilha dados entre contas. Para testar exclusivamente com dados fictícios, idealmente usar um projeto Firebase dedicado de testes.
- O Firestore real não foi criado/configurado nesta entrega; `firebase deploy`, App Check e Functions não foram executados. O backend de convites está **preparado separadamente no PR #2**, não implantado.
- Duas pipelines de CI aprovaram testes estáticos, fluxo local e regras no Emulator após a configuração Web. **OAuth Google, recuperação de senha e UX em Chrome Android/iPhone ainda dependem de teste real**.
- O site `https://feature-perfis-inteligentes.elida-homologacao.pages.dev/` é uma prévia anterior: não assumir que já está servindo essa branch sem verificar o deploy do Cloudflare.

## 1. Escopo e proteção de dados
- Visitante: lista, orçamento e perfis permanecem locais; não há chamada ao Firebase enquanto o usuário não escolhe a conta.
- Conta autenticada: apenas Google e e-mail/senha; não aceitar anônimos; e-mail deve estar verificado; sessão persiste apenas enquanto o navegador está aberto; chaves locais separadas por UID, sem copiar automaticamente conteúdo do visitante.
- **Importante:** login não cifra \`localStorage\`; pessoas que controlam o navegador/dispositivo podem ter acesso aos dados locais. Não armazenar perfil clínico em dispositivos compartilhados. Dados dos perfis alimentares nunca devem ir à nuvem sem base legal LGPD apropriada e salvaguardas adicionais.
- Backup exportado: arquivo \`.elida\` cifrado localmente com AES-256-GCM, PBKDF2-SHA256 600.000 iterações, sal/IV únicos, senha forte definida pelo usuário. A senha nunca é persistida. Backup sem senha de versões antigas só pode ser **importado** para migração; não gerar novos backups claros.
- Na restauração, NÃO criar cópia automática em texto puro. Exportar backup criptografado antes de restaurar se precisar de rollback.
- IA: fotos de rótulo são processadas no dispositivo; resultado é rascunho, não atesta segurança alimentar/ausência de alérgenos; sem aprovação clínica. OPEN FOOD FACTS em produção fica OFF até revisão de licença, privacidade, precisão e quotas.

## 2. Firestore real — ainda não aplicado
**Ferramentas de GitHub não concedem administração de projeto Firebase.** No Console do Firebase, verificar o ID \`projeto-elida-aplv\`, conta administradora, localização do banco, regras ATUAIS e existência de documentos. Se não existir banco, a criação precisa ser autorizada e realizada pelo responsável; NÃO utilizar "modo de teste" com regras públicas.

Após confirmar banco, projeto e backup/rollback das regras, revisar \`firestore.rules\` e executar todos os testes de emulador para projeto \`demo-elida-acl\`. O arquivo exige:
- sessão Firebase com e-mail verificado;
- vínculo ativo \`casas/{casaId}/membros/{uid}\`;
- zero concessão de membro, criação de casa ou alteração de ACL pelo cliente;
- zero acesso a coleções não aprovadas;
- negação por padrão.

**O backend confiável de criação de famílias/convites e revogação de membros ainda NÃO existe.** Até desenvolver e testar esse backend, o app deve permanecer local e a sync permanecer desligada, inclusive se alguém injetar config. Não publicar regras que permitam "qualquer autenticado" ou IDs de casa compartilhados por link sem autorização.

Somente depois de CI verde, revisão de estado/rollback e permissão explícita, o operador autenticado pode usar o Firebase CLI:
\`\`\`sh
firebase login
firebase deploy --only firestore:rules --project projeto-elida-aplv
\`\`\`
Esse comando afeta o Firestore REAL. **Não executar nesta etapa.** Nunca enviar token, senha, chave privada de conta de serviço ou segredo ao chat/repositório.

## 3. Login Firebase — código configurado, teste real pendente

- App **Elida Web** registrado; configuração SDK Web pública incorporada a `elida-firebase-config.js` **apenas para homologação**. `getAnalytics` não é utilizado.
- Os provedores Google e e-mail/senha devem ser conferidos em Authentication > Método de login; as configurações e domínios devem ser verificados no Console.
- Antes de tentar autenticar, em Authentication > Configurações > Domínios autorizados, liberar somente o host exato efetivamente usado em testes (ex.: `feature-perfis-inteligentes.elida-homologacao.pages.dev`, se este receber a nova branch). Não autorizar host aleatório nem domínio com curingas.
- Validar em ambiente hospedado: popup Google em Android/iPhone, cadastro e e-mail verificado, senha inválida, recuperação e logout, perda da sessão e modo visitante offline.
- O login permite identificar contas, mas o armazenamento local continua em `localStorage` sem cifra; dados de pessoas diferentes ficam em namespaces distintos por UID, **sem proteção contra quem controla o mesmo dispositivo/navegador**.
- **Não há sincronização nem provisionamento de família nesta PR.** Emulador com ACL não substitui teste no Firestore real. Não publicar regras/deploy ou habilitar Blaze sem análise separada.
- As chaves do SDK Web são públicas e **não** autorizam operações de administração. Não guardar credenciais sensíveis no código-fonte.

## 4. Cabeçalhos HTTP e hospedagem
\`_headers\` aplica cabeçalhos em Cloudflare Pages, não em GitHub Pages. Production \`https://kaleb-nunes.github.io/mercado-da-casa/\` exige outro host, proxy ou migração antes que as proteções HTTP (CSP, frame-ancestors, HSTS, X-Content-Type-Options, COOP, Permissions-Policy) surtam efeito.

A CSP de homologação usa \`script-src 'self' https://www.gstatic.com 'wasm-unsafe-eval'\`: não permite script inline, mas exige \`wasm-unsafe-eval\` para OCR no navegador. Validar Google popup, OCR, instalação PWA e imagens após ativação no Cloudflare Pages. O domínio de homologação deve manter \`X-Robots-Tag: noindex\`; isso **não** pode ser levado à produção sem ajuste consciente.

Validar com DevTools/Network a resposta HTTP real (não só o arquivo \`_headers\`) para cada rota e recurso; capturar evidências. Para produção, planejar migração reversível e manutenção de acesso aos dados locais do navegador (origens diferentes **não compartilham** localStorage!). Planejar migração de dados com backup cifrado/importação explícita, sem cópia automática.

## 5. Critérios de liberação
- [ ] Todas as verificações do GitHub Actions aprovadas no SHA candidato, inclusive teste de integridade AES-GCM, XSS, IA e Firestore Emulator.
- [ ] Teste manual de backup de 2 MB e restauração em Android e iOS, com senha errada, arquivo adulterado e perda de conexão.
- [ ] Login real testado em dois usuários isolados; provedor Google popup e e-mail verificado; modo visitante sem rede Firebase.
- [ ] Perfis de saúde protegidos e revisão LGPD; resultados de rótulo não fazem afirmações clínicas de segurança.
- [ ] Headers reais confirmados no Cloudflare Pages (inclui antiframe, nosniff, CSP e COOP).
- [ ] Plano de migração de origem e backup/rollback dos dados testado em dispositivo real.
- [ ] Regras reais Firestore avaliadas com autorização de implantação e backend de membros pronto, antes de qualquer sync.
- [ ] Aprovação explícita do proprietário para merge e deploy de produção.

**Se qualquer etapa falhar: abortar publicação.** Não revogar acesso, destruir dados, publicar regras nem migrar domínio de forma automática.
