-- Початковий залишок пише сама база, а не застосунок.
-- Застосовується ДО пуша коду, який на це розраховує.
--
-- 0017 зробила журнал повним, але вставити товар одразу з кількістю досі
-- можна — повз журнал. Застосунок це обходив, проте логіка на клієнті не
-- є довіреною: правило, яке тримає цілісність, має жити в базі.
-- Тригер дописує подію 'opening' для будь-якої ненульової кількості при
-- створенні, хоч звідки прийшов запит.
create or replace function public.items_opening_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Відновлення з копії (scripts/restore-sql.mjs) переносить журнал
  -- цілком, разом із початковими залишками. Дописати їх ще раз означало
  -- б подвоїти кількість, тож під час відновлення тригер мовчить.
  if current_setting('zapasy.restoring', true) = 'on' then
    return null;
  end if;

  if new.qty <> 0 then
    insert into public.events (user_id, item_id, delta, kind, bucket, created_at)
    values (new.user_id, new.id, new.qty, 'opening', 'stock', new.created_at);
  end if;

  if new.in_use <> 0 then
    insert into public.events (user_id, item_id, delta, kind, bucket, created_at)
    values (new.user_id, new.id, new.in_use, 'opening', 'in_use', new.created_at);
  end if;

  return null;
end;
$$;

create trigger items_opening_balance
  after insert on public.items
  for each row execute function public.items_opening_balance();
