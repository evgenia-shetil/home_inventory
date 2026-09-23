-- «Скільки мати» — це інше число, ніж «коли сигналити». Поріг каже, коли
-- повідомити; ціль каже, до скількох доповнити. Без неї список покупок
-- знає, що чогось бракує, але не знає, скільки брати.
alter table public.categories
  add column target numeric check (target >= 0);

-- Не все треба поповнювати: разова річ, скінчившись, інакше оселяється
-- у списку покупок назавжди.
alter table public.items
  add column recurring boolean not null default true;

grant update (recurring) on public.items to authenticated;
