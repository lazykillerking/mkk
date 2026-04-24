alter table public.challenges
  add column if not exists author text not null default 'admin',
  add column if not exists difficulty text not null default 'Easy',
  add column if not exists hints text[] not null default '{}';

alter table public.challenges
  alter column author set default 'admin',
  alter column difficulty set default 'Easy',
  alter column hints set default '{}';

update public.challenges
set
  author = coalesce(nullif(author, ''), 'admin'),
  difficulty = coalesce(nullif(difficulty, ''), 'Easy'),
  hints = coalesce(hints, '{}');

alter table public.challenges
  alter column author set not null,
  alter column difficulty set not null,
  alter column hints set not null;

alter table public.challenges
  drop constraint if exists challenges_difficulty_check;

alter table public.challenges
  add constraint challenges_difficulty_check
  check (difficulty in ('Easy', 'Medium', 'Hard'));
