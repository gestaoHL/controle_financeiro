# Finanças HL

Controle financeiro familiar. Site estático (sem servidor, sem build step),
hospedado no GitHub Pages. Supabase é o único backend (Auth + Postgres +
Storage).

## Configuração (primeira vez)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor do projeto, rode o conteúdo de `supabase/schema.sql`
   inteiro, uma vez.
3. Em Storage, confirme que o bucket `comprovantes` foi criado (o script
   acima já cria) e está privado.
4. Copie `js/config.example.js` para `js/config.js` e preencha com a URL e
   a chave `anon` do seu projeto Supabase (Settings > API). `js/config.js`
   é ignorado pelo git — cada ambiente (seu navegador local, o GitHub
   Pages) precisa do seu próprio.
5. Abra `login.html` num servidor estático local (ex: `npx serve .`) ou
   publique via GitHub Pages.
6. Cadastre-se — o primeiro usuário a se cadastrar vira administrador
   automaticamente. Os seguintes precisam ser aprovados na tela Membros.

## Publicar no GitHub Pages

1. Configure o `js/config.js` de produção (repita o passo 4 acima, mas
   como esse arquivo é ignorado pelo git, publique-o manualmente: edite
   direto na branch de publicação ou adicione uma exceção no
   `.gitignore` só para esse deploy — a chave `anon` é pública por design,
   não é segredo).
2. No GitHub, em Settings > Pages, aponte para a branch `main`, pasta raiz.
3. O site fica em `https://<usuario>.github.io/<repo>/`.

## Testes

```
npm test
```

Cobre funções puras (formatação, parser de extrato OFX). Fluxos de
autenticação e RLS são verificados manualmente — ver checklist de QA no
final do plano de implementação.
