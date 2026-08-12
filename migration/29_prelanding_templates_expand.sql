-- 29: allow all article prelanding templates (20 existing + 8 new topics)
-- The original constraint only permitted the 5 legacy values, which blocks
-- saving any article_* template from the dashboard.

ALTER TABLE public.links DROP CONSTRAINT IF EXISTS links_prelanding_template_check;

ALTER TABLE public.links
  ADD CONSTRAINT links_prelanding_template_check
  CHECK (prelanding_template IN (
    'none','verify','reward','countdown','article',
    'article_health','article_news','article_finance','article_lifestyle',
    'article_tech','article_celebrity','article_business','article_travel',
    'article_cooking','article_gardening','article_pets','article_sports',
    'article_education','article_parenting','article_music','article_movies',
    'article_diy','article_photography','article_fitness','article_crafts',
    'article_coffee','article_books','article_science','article_history',
    'article_language','article_organizing','article_cycling','article_weather'
  ));
