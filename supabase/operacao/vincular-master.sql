-- Executar como operador no SQL Editor após o login Google da conta escolhida.
-- Substituir UUID e e-mail localmente. O cadastro só aceita uma identidade Google
-- com e-mail verificado, o mesmo e-mail atual e o UUID confirmado pelo operador.
do $$
declare
  alvo uuid := '00000000-0000-0000-0000-000000000000';
  endereco text := 'substituir@example.invalid';
begin
  if not exists(select 1 from auth.users u join auth.identities i on i.user_id=u.id
    where u.id=alvo and u.email_confirmed_at is not null and lower(u.email)=lower(endereco)
      and i.provider='google' and lower(i.identity_data->>'email')=lower(endereco)
      and i.identity_data->>'email_verified'='true') then
    raise exception 'Identidade Google verificada e UUID correspondentes são necessários';
  end if;
  insert into elida_privado.master(uid) values(alvo) on conflict (uid) do nothing;
end $$;
