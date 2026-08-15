update public.links
set blocked_countries = coalesce((
  select array_agg(c)
  from unnest(blocked_countries) as c
  where upper(c) not in ('PH','BD','IN','ID','PK','NP','VN')
), '{}')
where blocked_countries && array['PH','BD','IN','ID','PK','NP','VN']::text[];