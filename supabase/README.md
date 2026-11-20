# Elida • piloto de migração
Esta branch substitui o login Firebase e as chamadas de aprovação na prévia. As contas Supabase recebem novos UUIDs. O visitante usa armazenamento local. A sincronização familiar continua desligada; não há transferência automática de perfis, listas ou históricos. A branch anterior é a referência para reversão.

## Ativação operacional
1. Usar um projeto Supabase Free exclusivo do piloto. Aplicar a migração em migrations e confirmar os privilégios no catálogo do banco.
2. Em Authentication habilitar confirmação por e-mail e Google. No cliente OAuth do Google cadastrar a URI de callback indicada pelo Supabase. No Supabase cadastrar a origem exata da prévia como Site URL, o retorno exato do app e o retorno com ?recuperar=1. Configurar SMTP próprio antes de testar cadastro/recuperação com destinatários externos. Segredos OAuth e SMTP ficam no painel do provedor.
3. Na raiz do checkout executar node supabase/operacao/configurar-previa.mjs ORIGEM URL CHAVE_PUBLICAVEL. Revisar que a CSP permite somente a origem do projeto para essa integração. Publicar na branch de homologação isolada.
4. O titular entra com Google. Um operador confere no painel Auth o UUID e o e-mail verificado, substitui os dois valores no modelo operacao/vincular-master.sql em sessão administrativa e executa. Este método protege contra substituição silenciosa de um master já cadastrado.
5. Testar Google, senha, confirmação/recuperação, solicitação de uma segunda conta, decisão pelo master, bloqueio e reinício. O cadastro usa PKCE e sessionStorage; completar o fluxo no contexto que o iniciou. Repetir os testes reais no iOS e Android. A aprovação é verificada no servidor; dados já baixados para o aparelho não podem ser apagados por uma revogação remota.
6. Antes de qualquer troca pública, testar exportação/restauração do Despensa e da prévia em uma cópia. O login no novo provedor não associa automaticamente os dados de outra conta ou domínio. Voltar para a versão Firebase se o teste falhar. Conservar o acesso ao app antigo até conferir os dados.

## Evidência local
tests/acessos.mjs roda em PostgreSQL via PGlite 0.5.17, com esquema auth de teste. Usa três identidades fictícias e os perfis anônimo/autenticado. Estes testes não verificam OAuth remoto, entrega de e-mail ou produção. Na raiz, com a dependência disponível, executar node supabase/tests/acessos.mjs.

O navegador usa a distribuição UMD oficial de @supabase/supabase-js 2.119.2 em vendor/supabase, com a licença correspondente. A chave service_role não participa do frontend.
