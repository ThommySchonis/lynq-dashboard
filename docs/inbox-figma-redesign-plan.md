# Inbox — план оновлення згідно Figma

**Figma:** [Lynq (main) 2 — Inbox frame](https://www.figma.com/design/6yzDt3MIQ6y05rt0QZOEjB/Lynq--main--2?node-id=776-15608)
**Скоуп:** тільки UI/UX. Бекенд не чіпаємо — максимально спираємось на наявні ендпоінти. Гепи бекенду виносимо в окремий трек (Частина B).

Розділи Figma в роботі: Inbox · Inbox_details · Up drop-downs · AI_Staged Tab · create Task · add note · Create order · Inbox_Create Ticket · Drop-Downs_Create Ticket · Search customers.

**Легенда:** ✅ бекенд готовий, будуємо повноцінно · 🟡 будуємо UI, але частина даних/дій впирається в бекенд → деградуємо gracefully (ховаємо / disable / за фіче-флагом / stub) і додаємо в BE-список.

---

## Частина A — UI/UX план (на наявному бекенді)

### Фаза 0 — Дизайн-токени
Звірити `Lynq platform/*` text-стилі та кольори (gold-заголовки `ASSIGN N TO`, success-пілюлі PAID/FULFILLED, VIP-пілюля) з `app/globals.css`. Без цього — не чіпати компоненти. Усі нові dropdown — через `components/ui/select.tsx` (пам'ятати render-функцію `SelectValue` + сигнатуру `(value: string | null)`).

### Фаза 1 — Inbox (список)
Файли: `components/features/inbox/thread-list-panel.tsx`, `bulk-actions-menu.tsx`, `mailbox-switcher.tsx`

- ✅ Таби Open/Pending/Resolved/Unlink + лічильники (`/counts` усе віддає). Лейбли → `lib/inbox-constants.ts`.
- ✅ Редизайн рядка треда: кольоровий аватар, ім'я+email, тема, превʼю, час, checkbox.
- ✅ Bulk: **Assign to** (members з `/members`, + «Assign to me» = поточний memberId), **Add tag** (search/create через `/tags`, 18 кольорів), **Delete** (confirm + count).
- ✅ **Snooze** у bulk: пресети Later today/Tomorrow/Next week рахуємо на фронті → `until` ISO (бекенд приймає).
- 🟡 **AI Staged** таб — UI робимо (Фаза 4), дані з `emma_draft_queue` поки не фільтруються як статус → BE-task #8.
- 🟡 **Move to** (Support/Sales/Returns/Wholesale): бекенд `move` міняє лише статус, не mailbox. Робимо UI «Move to» зі статусами як зараз; мульти-mailbox список → BE-task #1. Поки рендеримо тільки реальні `email_accounts` з `/accounts`.

### Фаза 2 — Inbox_details + Up drop-downs
Файли: `components/features/inbox/conversation-panel.tsx`, `ticket-action-bar.tsx`, `customer-sidebar.tsx`, `orders-section.tsx`, `composer.tsx`

- ✅ Top bar: заголовок, **status** dropdown (Open/Pending/Resolved/Unlink), **assign/Unassigned** dropdown, стрілки prev/next. Status+assign — через PATCH `/conversations/:id`.
- ✅ **snooze** dropdown (пресети→`until`), **«…»** меню (spam/delete/resolve — усе є в bulk/PATCH).
- ✅ Composer: таби Reply/Private note, форматування, **Suggested macros** + slash `/`, **Send / Send & Close**, хінт «Press R».
- ✅ Inline **Order summary** у треді (line items, subtotal/shipping/total, payment/delivery/shipping address — `/shopify/orders/:id` усе віддає).
- ✅ Notes «INTERNAL NOTES (n)» inline-add (`/:id/notes`).
- ✅ Customer sidebar: картка (email/phone/location/customer since — усе є), KPI **SPENT / ORDERS**, order-картки з пілюлями PAID/FULFILLED + дії Duplicate/Task/Refund/Cancel.
- 🟡 **REFUND %** KPI → даних немає (BE-task #2): поки ховаємо колонку або показуємо «—».
- 🟡 **VIP** бейдж → нема поля (BE-task #3): тимчасово виводимо з Shopify `tags` (якщо містить «VIP»), інакше ховаємо.
- 🟡 **Open Timeline** → немає уніфікованого timeline (BE-task #4): кнопку показуємо, відкриваємо наявні messages+notes; order-історію — окремим fetch або disable.
- ⚠️ Ticket meta (Contact reason/Product/Resolution/tier) — PATCH їх **не зберігає** (тільки status/assignee/is_unread/metadata). Тимчасово пишемо в `metadata` (бекенд приймає) або BE-task #11. **Потребує рішення — див. відкрите питання.**

### Фаза 3 — Модалки: create Task, add note, Create order
Файли: `components/shared/modals/create-task-modal.tsx`, `note-modal.tsx`, `create-order-modal.tsx`

- ✅ **Create Task**: TITLE/DESCRIPTION/PRIORITY/CATEGORY/ASSIGN TO + LINKED ORDER (read-only) — поля є в `types/tasks.ts`.
- ✅ **Create Order**: пошук продуктів, line items зі spinner-ами, Notes, **Add discount** (percentage/fixed), Order summary, створення draft order. Бекенд `createDraftOrder` приймає lineItems+discount+note+shippingAddress, повертає `invoiceUrl`.
- 🟡 Лейбл «& send Shopify invoice» + **VAT-рядок**: VAT рахує Shopify, окремого «send invoice» нема → текст кнопки приводимо до реальної поведінки (draft order + invoiceUrl) або BE-task #5. Promo-code «Apply» — бекенд знає лише percentage/fixed → promo як UI поверх (мапимо на fixed/percentage) або ховаємо.
- 🟡 **Add Note**: модалку робимо; лейбл «VISIBLE IN SHOPIFY» — sync у Shopify відсутній (BE-task #6) → поки прибрати/позначити «internal», бекенд пише internal note.

### Фаза 4 — AI_Staged Tab
Файли: `components/features/inbox/emma-suggestion-card.tsx`, `decline-feedback-popover.tsx`, `stores/ai.ts`

- ✅ Картка AI-чернетки: дії **Mark as reviewed / Edit reply / Take it back**, **Regenerate** (повторний виклик `/api/ai/reply`).
- ✅ **Feedback popover** (Wrong tone/info/Too long/Missing detail/Made it up + коментар): категорії вже визначені в `ai-drafts`.
- 🟡 **AI Staged таб/черга** як окремий список → `emma_draft_queue` не віддається як фільтр (BE-task #8). UI готуємо, дані підключаємо після BE.
- 🟡 **Helpful? Yes/No** + submit feedback → ендпоінта прийому фідбеку нема (BE-task #7): UI робимо, сабміт за фіче-флагом/no-op до готовності.
- 🟡 **Tone popover** (Match customer/Friendly/Professional/Concise/Apologetic) → `/api/ai/reply` не приймає tone (BE-task #9): UI робимо, параметр почнемо слати після BE.

### Фаза 5 — Create Ticket + Drop-Downs + Search customers ✅ ЗАКРИТО
Реалізовано: `app/(protected)/inbox/create/page.tsx` (тонкий orchestrator) + `components/features/inbox/create-ticket/{recent-panel,composer,details-panel}.tsx` + хук `hooks/inbox/use-create-ticket.ts`. Мертвий `create-ticket-view.tsx` видалено.

- ✅ Create Ticket: 3-колонковий Figma-layout (recent · composer · ticket-details). Subject + **priority/assign у subject-хедері**, composer TO/From/**Cc/Bcc**, форматування, macros, Send/Send & Close. UI піксельно звірено з Figma (`1372:68435`, `1372:68437`, `782:25968`).
- ✅ Drop-Downs: priority (Select) + assign (перевикористаний `ConversationAssignMenu` з Фази 2).
- ✅ **Двокрокова персистенція** (`use-create-ticket.ts`): compose → `conversationId` → best-effort PATCH `metadata` (priority/contact_reason/product/resolution) + bulk `assign` + `add_tag` (з `createTag` за потреби).
- ✅ Картка клієнта — **auto з TO-email** (`useCustomerSearch`), без окремого поля пошуку. 🟡 Location/LTV/VIP деградують у «—» (BE #2/#3).
- **Рішення по скоупу:** поле **Search customers** на Create Ticket **прибрано** (за вимогою). Standalone-екрани **Search customers** і **Create new contact** (BE #10/#12) **не робимо** — Фазу 5 закрито без них; повернутись можна після закриття BE-боргу.

---

## Частина B — Backend tasks (паралельний трек)

| # | Задача | Навіщо (UI) | Орієнтир у коді |
|---|---|---|---|
| 1 | **Move to mailbox**: bulk `move` має таргетити інший email-account, не лише статус; концепт кількох inbox (Support/Sales/…) | Bulk «Move to» + Move-dropdown | `supabase/functions/api/routes/inbox-conversations.ts` `MOVE_STATUSES` |
| 2 | **Refund % на клієнта** у customer-відповіді | KPI REFUND % | `supabase/functions/api/routes/shopify.ts` customer |
| 3 | **VIP/tier поле** клієнта (структуроване, не з tags-рядка) | VIP бейдж | shopify.ts customer |
| 4 | **Open Timeline**: уніфікований timeline (emails+orders+refunds) на клієнта | Кнопка «Open Timeline» | новий endpoint |
| 5 | **Create Order**: явний «send Shopify invoice» + повернення VAT-рядка у summary (опц., понад draft+invoiceUrl) | Кнопка «Create Draft order & send Shopify invoice», VAT | shopify.ts `createDraftOrder` |
| 6 | **Note visible in Shopify**: sync internal note у Shopify order note | Лейбл «VISIBLE IN SHOPIFY» | notes endpoint |
| 7 | **AI feedback submit** endpoint (categories + comment + Yes/No) | Helpful? + decline feedback | `ai-drafts` (поля є, route нема) |
| 8 | **AI Staged як фільтр/статус** у list-endpoint (експонувати `emma_draft_queue`) | AI Staged таб/черга | inbox-conversations.ts list + `emma_draft_queue` |
| 9 | **AI tone** параметр у `/api/ai/reply` | Tone popover | `app/api/ai/reply/route.ts` `aiReplyBody` |
| 10 | **Customer search** по location / lifetime value / order count | Розширений Search customers | shopify.ts customer search |
| 11 | **PATCH ticket meta**: зберігати Contact reason/Product/Resolution/tier (якщо не лишаємо в `metadata`) | Ticket action bar поля | inbox-conversations.ts PATCH |
| 12 | **Create customer/contact** endpoint | «Create new contact» форма | shopify.ts (нема) |
| 13 | **Regenerate** AI reply (якщо потрібен окремий контракт) | Кнопка Regenerate | ai/reply |

**Стратегія для всіх 🟡:** будуємо повний UI з Figma, а функції з gap-ом ставимо за фіче-флагом / disabled / graceful-fallback, щоб не блокувати фронт-роботу. Як тільки BE-задача закрита — знімаємо флаг.

---

## Послідовність робіт
0. Токени → 1. Список + bulk → 2. Conversation detail + up drop-downs → 3. Модалки → 4. AI Staged → 5. Create Ticket + Search customers.

**Статус: Фази 1–5 завершені.** Лишається паралельний BE-трек (Частина B) — після закриття задач знімаємо 🟡-флаги/stub-и.

## Відкрите питання — ВИРІШЕНО
**Contact reason / Product / Resolution / tier** (BE-task #11): обрано записувати в наявне `metadata` (Create Ticket пише `priority`/`contact_reason`/`product`/`resolution` у `metadata` через PATCH). Окремі колонки — за бажанням у BE #11; фронт уже працює.
