// Executar com @electric-sql/pglite 0.5.17 nas dependências de desenvolvimento.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const db = new PGlite();
const master='00000000-0000-4000-8000-000000000001';
const comum='00000000-0000-4000-8000-000000000002';
const semConfirmacao='00000000-0000-4000-8000-000000000003';
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
await db.exec(await readFile(new URL('../migrations/202611200001_acessos.sql',import.meta.url),'utf8'));
await db.query("insert into auth.users values ($1,'master@example.test',now(),false),($2,'usuario@example.test',now(),false),($3,'pendente@example.test',null,false)",[master,comum,semConfirmacao]);
await db.query("insert into elida_privado.master(uid) values ($1)",[master]);
async function entrar(uid){
  await db.exec('reset role; set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
}
async function acesso(){return (await db.query('select public.elida_meu_acesso() as v')).rows[0].v;}
await db.exec('set role anon');
await assert.rejects(db.exec('select public.elida_meu_acesso()'),{code:'42501'});
await entrar(semConfirmacao);
await assert.rejects(acesso(),{code:'42501'});
await entrar(comum);
assert.equal((await acesso()).status,'nao_solicitado');
await db.exec('select public.elida_solicitar()');
assert.equal((await acesso()).status,'pendente');
await assert.rejects(db.exec('select * from public.elida_listar(true)'),{code:'42501'});
await assert.rejects(db.query("select public.elida_decidir($1,'aprovar')",[comum]),{code:'42501'});
await assert.rejects(db.exec('select * from elida_privado.master'),{code:'42501'});
await entrar(master);
assert.equal((await acesso()).papel,'superadmin');
assert.equal((await db.query('select uid from public.elida_listar(true)')).rows[0].uid,comum);
await db.query("select public.elida_decidir($1,'aprovar')",[comum]);
await entrar(comum);
assert.deepEqual(await acesso(),{papel:'usuario',status:'aprovado'});
await entrar(master);
await db.query("select public.elida_decidir($1,'bloquear')",[comum]);
await entrar(comum);
await db.exec('select public.elida_solicitar()');
assert.equal((await acesso()).status,'bloqueado');
console.log('OK: anônimo, e-mail pendente, isolamento da conta comum, master, aprovação e bloqueio.');
await db.close();
