# ELIDA IA — Portões de homologação e implantação segura (20/11/2026)

**Estado atual:** candidato de homologação na branch \`feature/elida-ia-auth-backup-seguro-20261120\`. Não foi publicado nem foi conectado ao Firebase real. \`elida-firebase-config.js\` permanece \`null\`; sincronização familiar legada permanece bloqueada.

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

## 3. Login Firebase real — ainda inativo
Authentication já estava com Google e e-mail/senha habilitados em captura do Console. A aba de visão geral mostrava "Adicione um app" e a tela Firestore mostrava "Criar banco de dados"; conferir novamente antes de agir.

Para ligar o login:
1. Firebase Console > Configurações do projeto > Seus aplicativos > **Adicionar app Web**.
2. Cadastrar aplicativo \`Elida Web\`; copiar só os campos públicos \`apiKey\`, \`authDomain\`, \`projectId\`, \`appId\`.
3. Verificar o endereço exato de homologação em Authentication > Configurações > Domínios autorizados; não adicionar domínios amplos ou desconhecidos.
4. Verificar proteção contra enumeração de e-mails e política de senhas no Firebase.
5. Preencher \`elida-firebase-config.js\` **somente em uma branch de homologação**, com os valores oficiais. \`projectId\` deve ser \`projeto-elida-aplv\`, \`authDomain\` deve ser \`projeto-elida-aplv.firebaseapp.com\`.
6. Em ambiente de teste isolado, testar conta Google, cadastro/e-mail verificado, senha errada, recuperação, logout, sessão expirada, navegador offline e dispositivo Android/iOS.
7. Verificar que UID A não lê dados locais de UID B nem dados do visitante, e que Firestore real **nega** acesso quando não existe vínculo de membro.
8. Não usar chaves de SDK Web como substituto de regras Firestore; elas **não são credenciais de administrador**.

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
