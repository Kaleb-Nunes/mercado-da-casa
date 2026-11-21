begin;
create schema elida_privado;
revoke all on schema elida_privado from public, anon, authenticated;
create table elida_privado.master (
  unico boolean primary key default true check (unico),
  uid uuid unique not null references auth.users(id) on delete restrict
);
create table elida_privado.acessos (
  uid uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado','bloqueado'))
);
alter table elida_privado.master enable row level security;
alter table elida_privado.acessos enable row level security;
revoke all on all tables in schema elida_privado from public, anon, authenticated;

-- As chamadas usam a identidade do token validado pelo Supabase.
create function elida_privado.usuario() returns uuid
language plpgsql stable set search_path = '' as $$
declare id_usuario uuid := auth.uid();
begin
  if not exists (select 1 from auth.users u where u.id=id_usuario and u.email_confirmed_at is not null and u.is_anonymous is not true) then
    raise exception 'Conta verificada necessária' using errcode='42501';
  end if;
  return id_usuario;
end $$;

create function public.elida_meu_acesso() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare id_usuario uuid := elida_privado.usuario();
begin
  if exists(select 1 from elida_privado.master where uid=id_usuario) then
    return jsonb_build_object('papel','superadmin','status','aprovado');
  end if;
  return jsonb_build_object('papel','usuario','status',coalesce((select status from elida_privado.acessos where uid=id_usuario),'nao_solicitado'));
end $$;

create function public.elida_solicitar() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  insert into elida_privado.acessos(uid) values (elida_privado.usuario()) on conflict do nothing;
  return public.elida_meu_acesso();
end $$;

create function elida_privado.exigir_master() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists(select 1 from elida_privado.master where uid=elida_privado.usuario()) then
    raise exception 'Acesso restrito' using errcode='42501';
  end if;
end $$;
create function public.elida_listar(pendentes boolean) returns table(uid uuid,email text,status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform elida_privado.exigir_master();
  return query select a.uid,u.email::text,a.status from elida_privado.acessos a
    join auth.users u on u.id=a.uid where (not pendentes or a.status='pendente')
    and not exists(select 1 from elida_privado.master m where m.uid=a.uid) order by u.email,a.uid;
end $$;
create function public.elida_decidir(alvo uuid, decisao text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform elida_privado.exigir_master();
  if decisao is null or decisao not in ('aprovar','rejeitar','bloquear') or alvo=auth.uid() then raise exception 'Decisão inválida'; end if;
  update elida_privado.acessos set status=case decisao when 'aprovar' then 'aprovado' when 'rejeitar' then 'rejeitado' else 'bloqueado' end where uid=alvo;
  if not found then raise exception 'Conta desconhecida'; end if;
end $$;

revoke all on all functions in schema elida_privado from public, anon, authenticated;
revoke all on function public.elida_meu_acesso(),public.elida_solicitar(),public.elida_listar(boolean),public.elida_decidir(uuid,text) from public,anon,authenticated;
grant execute on function public.elida_meu_acesso(),public.elida_solicitar(),public.elida_listar(boolean),public.elida_decidir(uuid,text) to authenticated;
commit;
