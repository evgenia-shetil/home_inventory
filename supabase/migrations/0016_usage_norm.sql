-- Норма витрачання й заміна за графіком. Живе на ПІДКАТЕГОРІЇ, як поріг
-- і ціль: запас вимірюється потребою, а не маркою (інваріант 7).
-- Застосовується ДО пуша коду, який на це розраховує.

-- Норма: usage_qty одиниць кожні usage_months місяців.
-- «1 шт кожні 3 місяці», «2 рулони щомісяця». Необовʼязкова: без неї
-- темп береться з журналу, коли той набере історію.
alter table public.categories
  add column usage_qty    numeric check (usage_qty > 0),
  add column usage_months numeric check (usage_months > 0);

-- Деякі речі не закінчуються, а міняються в конкретну дату (зубна
-- щітка, фільтр), навіть якщо стара ще придатна. Для них памʼятаємо
-- дату останньої заміни: наступна = остання + usage_months.
alter table public.categories
  add column scheduled   boolean not null default false,
  add column replaced_on date;
