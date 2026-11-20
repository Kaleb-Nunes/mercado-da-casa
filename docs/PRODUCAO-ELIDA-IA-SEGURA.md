# Elida IA — plano operacional de liberação integral em produção

**Status em 20/11/2026:** NÃO LANÇAR COMO COMPARTILHAMENTO FAMILIAR FUNCIONAL antes dos requisitos abaixo. O PR #5 é uma candidata com testes de código e Firestore Emulator, não evidência de banco ou Functions reais. O proprietário autorizou a publicação, mas segurança depende das verificações técnicas.

## Ambientes confirmados

- Repositório `Kaleb-Nunes/mercado-da-casa`, branch `main`: publicação anterior no GitHub Pages, não suporta aplicação de `_headers`.
- Cloudflare Pages `elida-homologacao`: *production branch* `homologacao`, URL `https://elida-homologacao.pages.dev`; as demais branches são prévias, não a produção final.
- Candidata: `release/elida-ia-familias-candidata-20261120`; CI verde no emulador, nenhum deploy Firebase real efetuado.
- Firebase `projeto-elida-aplv`: Auth Google/e-mail ativado e host `elida-homologacao.pages.dev` autorizado. Estado atual de Firestore e Functions NÃO verificado por administrador; não alegar implantação.

## Bloqueios que precisam ser eliminados na ordem

### 1. Controle de faturamento (ação administrativa humana)
- Confirmar no console **qual plano atual**; Cloud Functions v2 exige o projeto configurado para faturamento, normalmente Blaze.
- Definir uma política de gastos, alertas e limites de instâncias; **alertas não são travas absolutas de gastos**.
- A autorização verbal para publicar o código não insere automaticamente dados de pagamento nem autoriza cobranças sem conhecimento do operador.
- Não colar conta de serviço, API privadas ou tokens no repositório.

### 2. Firestore real: criar com segurança e verificar regras
- No Console Firebase, **Firestore Database**, confirmar se o banco existe. Se não, criar em modo produção, em localidade compatível com privacidade, latência e custo, e registrar a escolha. **A localidade não pode ser simplesmente trocada após criação.**
- NÃO usar regras de teste abertas. Inicialmente restringir por padrão a todos os clientes até finalizar testes.
- Com CLI autenticada administrativamente, na raiz da candidata revisada:
  `firebase use projeto-elida-aplv`
  `firebase deploy --project projeto-elida-aplv --only firestore:rules`
- Verificar as regras efetivas no Console e, com **duas contas verificadas**, testar: proprietário, família externa, pessoa não verificada, membro revogado, acesso direto às coleções, tentativa de alteração de ACL e de consulta a perfis de dieta. Não usar contas/dados reais de crianças nos testes.

### 3. App Check + Cloud Functions v2
- Registrar o site definitivo no Firebase App Check com provedor suportado (ex.: reCAPTCHA Enterprise) e domínio de produção.
- **Ainda falta integrar inicialização e tokens App Check no frontend.** As funções usam `enforceAppCheck:true`; não desativar essa verificação para contornar o problema.
- Instalar e conferir dependências do backend Node.js 22, região `southamerica-east1`, IAM mínimo, limites `maxInstances` e cotas transacionais por conta/casa. Testar no emulador e em *staging* com dados fictícios.
- Após comprovação com ambiente e projeto reais:
  `firebase deploy --project projeto-elida-aplv --only functions`
- Testar endpoints autenticados: `criarCasa`, `criarConvite`, `aceitarConvite`, `revogarMembro`. Garantir vínculo do convite com e-mail verificado, token único de 24h e revogação efetiva.

### 4. Frontend familiar: eliminar legado antes de ativar
- Em `elida-app.js`, `SYNC_FAMILIAR_ACL_HOMOLOGADA=false` é um **bloqueio deliberado**. O código legado usa `signInAnonymously` e `setDoc` no cliente, incompatíveis com a ACL nova.
- **Ainda falta implementar a UI de família integrada via `httpsCallable(getFunctions(app,'southamerica-east1'),...)`, com App Check, modelo de vínculo, conexão e sincronização autenticadas.**
- Não mudar a constante para `true` nem migrar dados locais automaticamente. Projeto deve exigir backup criptografado conferido, migração versionada e possibilidade de reversão.
- Os dados de dietas, restrições alimentares, perfis e imagens pessoais permanecem **locais** por padrão e não devem ser enviados ao Firestore familiar sem base legal e consentimento granular.

### 5. IA e recomendações alimentares
- Motor de regras e OCR podem apoiar conferência, mas fontes como Open Food Facts são comunitárias e podem ter cadastro incorreto/incompleto.
- Em produção, a consulta externa ainda é bloqueada pela lógica de `criarProvedorIA` quando `!AMB.homologacao`. Ligar apenas depois de QA em aparelhos reais, texto de incerteza explícito, consentimento e análise de privacidade. Não afirmar segurança de consumo por criança alérgica.
- Testar perfis múltiplos, combinações de alergênicos, falta de ingredientes, rótulos ilegíveis, erro de rede, câmera negada, navegação em iPhone/Android.

### 6. Hospedagem produtiva com cabeçalhos
- Usar **projeto/domínio de produção distinto da homologação**, por exemplo Cloudflare Pages com branch de release homologada. A edição de cabeçalhos HTTP requer esse tipo de hospedagem.
- Registrar **o hostname exato de produção** no Firebase Authentication, App Check e na allowlist de `elida-firebase-config.js`. Não liberar hosts arbitrários.
- Confirmar via requisição HTTP real: CSP efetiva sem scripts inline, COOP compatível com Google popup, X-Frame-Options, nosniff, HSTS, Permissions-Policy, ausência de URLs com credenciais e cache restrito de PWA.
- Não indexar links de homologação; separar `_headers` de produção e de prévia.

### 7. Qualidade, observabilidade e decisão de publicar
- Firefox/Chrome/Safari móvel, iPhone e Android físicos, instalação PWA, atualização de service worker, offline/reconexão, restauração criptografada, gasto/lista/preview, login Google/e-mail, troca/logout e isolamento entre contas.
- Dois aparelhos, duas famílias, convites de uso único, convite expirado, senha errada, membro revogado, revogação durante sync, logout offline, troca de usuário e dados sensíveis.
- Auditoria LGPD, retenção e exclusão de conta/dados, política de privacidade e gestão de incidentes.
- Validar **backup real restaurável** antes de migração. Registrar resultados e aprovar go/no-go.
- Somente então efetuar merge controlado e deploy da versão validada. Monitorar erros e métricas não sensíveis, ter procedimento de rollback preservando dados locais.

## Estado de acesso deste assistente
Nesta conversa: GitHub com permissão de leitura/escrita e CI; navegador da conta **somente leitura**. Plugin Firebase está instalado no Codex, mas suas ações administrativas não estão expostas aqui. Sem acesso autenticado de escrita a Firebase/Cloudflare, não é possível comprovar criação do Firestore, faturamento, App Check ou deploy Cloud Functions. Fazer essas etapas com navegador controlável em modo Work ou com operador humano no Console; não inventar sucesso.

## Critério final para marcar `LIVE`
- Firestore real + regras publicadas + App Check verificados;
- Functions v2 reais + limites e faturamento auditados;
- Frontend usa exclusivamente Functions e ACL, nunca login anônimo/URLs públicas como autorização;
- IA e guest testados nos dois sistemas móveis;
- Segurança HTTP confirmada e consentimento/privacidade compatíveis;
- Procedimento de rollback e backup aprovados;
- Merge e domínio de produção revisados.
