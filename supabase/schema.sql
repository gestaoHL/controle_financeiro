-- ============================================================
-- FINANÇAS HL — SETUP DO SUPABASE
-- Rode este script UMA VEZ, inteiro, no SQL Editor do projeto Supabase.
-- ============================================================

create table if not exists public.perfis (
    id          uuid primary key references auth.users(id) on delete cascade,
    nome        text not null,
    email       text not null,
    papel       text not null default 'membro' check (papel in ('admin', 'membro')),
    status      text not null default 'pendente' check (status in ('pendente', 'aprovado')),
    created_at  timestamptz not null default now()
);

create table if not exists public.plano_contas (
    id          bigint generated always as identity primary key,
    tipo        text not null check (tipo in ('RECEITA', 'DESPESA')),
    descricao   text
);

create table if not exists public.contas (
    id          bigint generated always as identity primary key,
    plano_id    bigint not null references public.plano_contas(id) on delete cascade,
    nome        text not null
);

create table if not exists public.contas_bancarias (
    id            bigint generated always as identity primary key,
    nome          text not null,
    banco         text,
    agencia       text,
    numero_conta  text,
    created_at    timestamptz not null default now()
);

create table if not exists public.lancamentos (
    id                 bigint generated always as identity primary key,
    tipo               text not null check (tipo in ('RECEITA', 'DESPESA')),
    conta_id           bigint references public.contas(id) on delete set null,
    usuario_id         uuid not null references public.perfis(id),
    forma_pagamento    text check (forma_pagamento in ('pix', 'transferencia', 'cartao', 'dinheiro', 'boleto')),
    conta_bancaria_id  bigint references public.contas_bancarias(id) on delete set null,
    data               date not null,
    historico          text not null,
    descricao          text,
    valor              numeric not null check (valor > 0),
    comprovante_url    text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create table if not exists public.orcamento_valores (
    id          bigint generated always as identity primary key,
    ano         integer not null,
    mes         integer not null check (mes between 1 and 12),
    conta_id    bigint not null references public.contas(id) on delete cascade,
    valor       numeric not null default 0,
    unique (ano, mes, conta_id)
);

create table if not exists public.extrato_itens (
    id                 bigint generated always as identity primary key,
    conta_bancaria_id  bigint not null references public.contas_bancarias(id) on delete cascade,
    fitid              text not null,
    data               date not null,
    historico          text not null,
    tipo               text not null check (tipo in ('CREDITO', 'DEBITO')),
    valor              numeric not null check (valor > 0),
    status             text not null default 'pendente' check (status in ('pendente', 'conciliado')),
    lancamento_id      bigint references public.lancamentos(id) on delete set null,
    created_at         timestamptz not null default now(),
    unique (conta_bancaria_id, fitid)
);

create table if not exists public.historico_auditoria (
    id          bigint generated always as identity primary key,
    usuario_id  uuid references public.perfis(id),
    modulo      text,
    acao        text not null,
    detalhes    text,
    created_at  timestamptz not null default now()
);

-- ============================================================
-- BOOTSTRAP DE USUÁRIO — ao criar uma conta no Supabase Auth, cria
-- automaticamente a linha correspondente em perfis. O primeiro usuário
-- do sistema vira admin/aprovado; todos os demais entram
-- membro/pendente até um admin aprovar na tela Membros.
-- ============================================================
create or replace function public.criar_perfil_no_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    eh_primeiro boolean;
begin
    select not exists (select 1 from public.perfis) into eh_primeiro;

    insert into public.perfis (id, nome, email, papel, status)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
        new.email,
        case when eh_primeiro then 'admin' else 'membro' end,
        case when eh_primeiro then 'aprovado' else 'pendente' end
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.criar_perfil_no_signup();

-- ============================================================
-- CONCILIAÇÃO BANCÁRIA — funções SECURITY DEFINER. Ligar/desligar um item
-- de extrato a um lançamento grava em duas tabelas (extrato_itens e
-- lancamentos), mas a policy de UPDATE de lancamentos só permite o dono
-- ou um admin (ver mais abaixo) — conciliar o extrato de uma conta
-- compartilhada, porém, é uma tarefa estrutural da família, não uma
-- edição de lançamento de terceiro, então passa por aqui em vez de
-- depender da policy de UPDATE de lancamentos.
-- ============================================================
create or replace function public.conciliar_extrato(p_item_id bigint, p_lancamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado') then
        raise exception 'Usuário não aprovado.';
    end if;

    update public.extrato_itens
    set status = 'conciliado', lancamento_id = p_lancamento_id
    where id = p_item_id;

    update public.lancamentos
    set conta_bancaria_id = (select conta_bancaria_id from public.extrato_itens where id = p_item_id)
    where id = p_lancamento_id;
end;
$$;

create or replace function public.desfazer_conciliacao(p_item_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_lancamento_id bigint;
begin
    if not exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado') then
        raise exception 'Usuário não aprovado.';
    end if;

    select lancamento_id into v_lancamento_id from public.extrato_itens where id = p_item_id;

    update public.extrato_itens set status = 'pendente', lancamento_id = null where id = p_item_id;

    if v_lancamento_id is not null then
        update public.lancamentos set conta_bancaria_id = null where id = v_lancamento_id;
    end if;
end;
$$;

grant execute on function public.conciliar_extrato(bigint, bigint) to authenticated;
grant execute on function public.desfazer_conciliacao(bigint) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.perfis enable row level security;
alter table public.plano_contas enable row level security;
alter table public.contas enable row level security;
alter table public.contas_bancarias enable row level security;
alter table public.lancamentos enable row level security;
alter table public.orcamento_valores enable row level security;
alter table public.extrato_itens enable row level security;
alter table public.historico_auditoria enable row level security;

-- perfis: usuário vê/edita o próprio; admin vê/edita todos.
drop policy if exists "ve proprio ou admin ve todos" on public.perfis;
create policy "ve proprio ou admin ve todos" on public.perfis for select to authenticated
    using (id = auth.uid() or exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin'));

drop policy if exists "admin edita qualquer perfil" on public.perfis;
create policy "admin edita qualquer perfil" on public.perfis for update to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin'));

-- dado estrutural (plano_contas, contas, contas_bancarias, orcamento_valores):
-- qualquer aprovado lê e escreve.
do $$
declare
    nomes_tabelas text[] := array['plano_contas', 'contas', 'contas_bancarias', 'orcamento_valores'];
    nome_tabela text;
begin
    foreach nome_tabela in array nomes_tabelas loop
        execute format('drop policy if exists "aprovados tem acesso total" on public.%I;', nome_tabela);
        execute format(
            'create policy "aprovados tem acesso total" on public.%I for all to authenticated
             using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = ''aprovado''))
             with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = ''aprovado''));',
            nome_tabela
        );
    end loop;
end $$;

-- lancamentos: select liberado a qualquer aprovado (tela Transparência);
-- insert liberado a aprovados, sempre com usuario_id = auth.uid();
-- update/delete só pelo dono ou por admin.
drop policy if exists "aprovados leem todos os lancamentos" on public.lancamentos;
create policy "aprovados leem todos os lancamentos" on public.lancamentos for select to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

drop policy if exists "aprovados inserem seu proprio lancamento" on public.lancamentos;
create policy "aprovados inserem seu proprio lancamento" on public.lancamentos for insert to authenticated
    with check (
        usuario_id = auth.uid()
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    );

drop policy if exists "dono ou admin edita lancamento" on public.lancamentos;
create policy "dono ou admin edita lancamento" on public.lancamentos for update to authenticated
    using (
        usuario_id = auth.uid()
        or exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin')
    );

drop policy if exists "dono ou admin exclui lancamento" on public.lancamentos;
create policy "dono ou admin exclui lancamento" on public.lancamentos for delete to authenticated
    using (
        usuario_id = auth.uid()
        or exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'admin')
    );

-- extrato_itens: mesmo padrão de dado estrutural (qualquer aprovado).
drop policy if exists "aprovados tem acesso total" on public.extrato_itens;
create policy "aprovados tem acesso total" on public.extrato_itens for all to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'))
    with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

-- historico_auditoria: aprovados leem e inserem (não editam/excluem — é log).
drop policy if exists "aprovados leem historico" on public.historico_auditoria;
create policy "aprovados leem historico" on public.historico_auditoria for select to authenticated
    using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

drop policy if exists "aprovados inserem no historico" on public.historico_auditoria;
create policy "aprovados inserem no historico" on public.historico_auditoria for insert to authenticated
    with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

grant select, insert, update, delete on public.perfis, public.plano_contas, public.contas,
    public.contas_bancarias, public.lancamentos, public.orcamento_valores, public.extrato_itens,
    public.historico_auditoria to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================================
-- STORAGE — bucket privado para comprovantes de lançamento.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

drop policy if exists "aprovados acessam comprovantes" on storage.objects;
create policy "aprovados acessam comprovantes" on storage.objects for all to authenticated
    using (
        bucket_id = 'comprovantes'
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    )
    with check (
        bucket_id = 'comprovantes'
        and exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado')
    );

-- ============================================================
-- SEED — plano de contas padrão (editável depois pela tela Plano de Contas).
-- ============================================================
insert into public.plano_contas (tipo, descricao) values
    ('RECEITA', 'Receitas'),
    ('DESPESA', 'Despesas')
on conflict do nothing;

do $$
declare
    id_receita bigint;
    id_despesa bigint;
begin
    select id into id_receita from public.plano_contas where tipo = 'RECEITA' order by id limit 1;
    select id into id_despesa from public.plano_contas where tipo = 'DESPESA' order by id limit 1;

    if id_receita is not null and not exists (select 1 from public.contas where plano_id = id_receita) then
        insert into public.contas (plano_id, nome) values
            (id_receita, 'Salário'),
            (id_receita, 'Renda Extra / Freelance'),
            (id_receita, 'Investimentos'),
            (id_receita, 'Outros');
    end if;

    if id_despesa is not null and not exists (select 1 from public.contas where plano_id = id_despesa) then
        insert into public.contas (plano_id, nome) values
            (id_despesa, 'Moradia'),
            (id_despesa, 'Alimentação'),
            (id_despesa, 'Transporte'),
            (id_despesa, 'Saúde'),
            (id_despesa, 'Educação'),
            (id_despesa, 'Lazer'),
            (id_despesa, 'Assinaturas'),
            (id_despesa, 'Cartão de Crédito'),
            (id_despesa, 'Investimentos'),
            (id_despesa, 'Impostos'),
            (id_despesa, 'Doações'),
            (id_despesa, 'Outros');
    end if;
end $$;
