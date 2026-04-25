alter table public.challenges
  drop constraint if exists challenges_difficulty_check;

alter table public.challenges
  add constraint challenges_difficulty_check
  check (difficulty in ('Easy', 'Medium', 'Hard', 'Insane'));

alter table public.challenges
  alter column hints drop default;

alter table public.challenges
  alter column hints type jsonb
  using coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'text', nullif(trim(hint_text), ''),
          'cost', 0
        )
      )
      from unnest(coalesce(hints, '{}'::text[])) as hint_text
      where nullif(trim(hint_text), '') is not null
    ),
    '[]'::jsonb
  );

update public.challenges
set hints = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'text', nullif(trim(hint_item ->> 'text'), ''),
        'cost', greatest(coalesce((hint_item ->> 'cost')::integer, 0), 0)
      )
    )
    from jsonb_array_elements(
      case
        when jsonb_typeof(hints) = 'array' then hints
        else '[]'::jsonb
      end
    ) as hint_item
    where nullif(trim(hint_item ->> 'text'), '') is not null
  ),
  '[]'::jsonb
);

alter table public.challenges
  alter column hints set default '[]'::jsonb,
  alter column hints set not null;
