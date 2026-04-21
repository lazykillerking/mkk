create view public.user_category_rankings as
select 
  u.id, 
  u.username, 
  u.about, 
  u.created_at, 
  null::text as joined_ago, 
  u.last_active_at, 
  c.category,
  sum(c.points) as score, 
  count(s.challenge_id) as solves_count, 
  cast(rank() over (partition by c.category order by sum(c.points) desc, max(s.solved_at) asc) as int) as rank
from public.users u
join public.solves s on u.id = s.user_id
join public.challenges c on s.challenge_id = c.id
group by u.id, u.username, u.about, u.created_at, u.last_active_at, c.category;

-- granting permissions
grant select on public.user_category_rankings to anon, authenticated;
