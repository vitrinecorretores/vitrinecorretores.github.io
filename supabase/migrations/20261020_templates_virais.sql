-- Estilos virais de carrossel (Manchete, Post de rede social, Checklist, Bloco de cor).
-- Idempotente: só insere o slug que ainda não existe; se já existir, apenas reativa/atualiza nome e descrição.
-- O desenho em si (canvas e prévia) fica no front (app.js: ESTILOS_VIRAIS / index.html: .tpl-<slug>).
insert into public.templates (slug, nome, descricao, ativo)
select v.slug, v.nome, v.descricao, true
from (values
  ('manchete',    'Manchete',          'Estilo notícia: selo vermelho, foto escurecida e manchete gigante em caixa-alta.'),
  ('post-social', 'Post de rede social','Parece print de post: avatar, selo verificado e texto grande.'),
  ('checklist',   'Checklist',         'Número gigante em cada item — ótimo para listas e passo a passo.'),
  ('bloco-cor',   'Bloco de cor',      'Fundo sólido na cor escolhida, texto gigante e sem foto.')
) as v(slug, nome, descricao)
where not exists (select 1 from public.templates t where t.slug = v.slug);

update public.templates t
   set nome = v.nome, descricao = v.descricao, ativo = true
  from (values
    ('manchete',    'Manchete',          'Estilo notícia: selo vermelho, foto escurecida e manchete gigante em caixa-alta.'),
    ('post-social', 'Post de rede social','Parece print de post: avatar, selo verificado e texto grande.'),
    ('checklist',   'Checklist',         'Número gigante em cada item — ótimo para listas e passo a passo.'),
    ('bloco-cor',   'Bloco de cor',      'Fundo sólido na cor escolhida, texto gigante e sem foto.')
  ) as v(slug, nome, descricao)
 where t.slug = v.slug;
