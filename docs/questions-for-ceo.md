# Questions for the CEO

Ordered by how much each answer changes the data model. Tags like `purchases.status` point to the draft schema field the answer affects.

## 1. Scope: shops and users
1. Which shops will use this at launch? Only TCOS merch, or also Keep It Secret / GUINS'? (Spruce Haus rentals and Casa Sardine bookings don't fit a purchase system.)
2. Who manages each shop? Should staff of one shop be blocked from seeing another shop's orders, or is one admin for everything enough? `users.role` only has `user` / `admin`.
3. Must online buyers log in with their enrollment-website account, or can anyone check out as a guest? If login is required, people who never enrolled can't buy. `users.password_hash`, `purchases.users`
4. Should the buyer's saved name, phone and address be pre-filled but editable per order (e.g. sending a gift to another address)? `users.address` is one string, while the current form asks for 5 address fields plus a LINE ID.
5. Some emails in the enrollment data have typos. Will the shop contact buyers by email (order confirmation, tracking), or only by phone/LINE? `users.email`

## 2. Products and variants
6. Which shirt sizes exist? Is there a size chart? What does the รวมพลคนมิวสิคัลคลับ shirt cost on its own? (No single price was published.)
7. Will any product have two options at once, e.g. a shirt in 2 colours × 5 sizes? `variants` has one `name` per variant, so every combination would need its own variant.
8. Random keychain bag: how many characters are there? Do you need stock tracked per character, or only per bag?
9. Is the buy limit per order, or per person across all orders? Is it per variant (e.g. max 5 red caps) or per product (max 5 caps of any colour)? `variants.buy_limit`
10. Are products grouped by project/collection (e.g. รวมพลคนมิวสิคัลคลับ, The Hidden Saloon) for display or sales reports? The schema has no collection field.

## 3. Stock: online vs. on-site
11. Is stock split up front into online stock and each POS location's stock? Can stock be moved between them during or after an event? `variants.online_stock`, `pos[].pos_stock`
12. Does an online order reserve stock when it is placed, or only once the slip is verified? (If it's at placement, unpaid orders hold stock. If it's at verification, two buyers can pay for the last item.)
13. Are some items sold only on-site or only online? Can the same item have a different price on-site vs. online? (GUINS' already uses different prices per channel.) `variants.visible_to_online`

## 4. Promotions
The draft `promotions` only supports **x% off** and **x ฿ off** a product or variant. Every promotion TCOS published is something else:

| Published promotion | Kind |
|---|---|
| Keychain bag ×3 for 310 ฿, ×6 for 599 ฿, sticker ×4 for 100 ฿, ×6 for 139 ฿ | Buy N of the same item for a fixed price |
| Shirt + cap for 500 ฿, card holder + umbrella for 399 ฿ | Fixed price for a set of different items |
| 719 ฿ set **plus 3 free stickers** | Set + free gift |

14. Should these bundle types be supported, or will promotions be limited to % / ฿ off from now on?
15. In sticker ×4/×6 and the 719 ฿ set, does the buyer **choose** the designs, or are they random? In shirt + cap sets, does the buyer choose size and colour? Do free gifts come out of stock?
16. Should the system apply a bundle automatically when the cart qualifies (e.g. 3 keychain bags → 310 ฿), or must the buyer pick the bundle?
17. Can promotions stack? Do they have start and end dates? Do they apply online, on-site, or both?
18. With % discounts, how should fractions of a baht be rounded (down, up, nearest)? Per item or per order?
19. Is the card holder + umbrella bundle (399 ฿) still active? It is in the story but not in the form.

## 5. Payment
20. Which PromptPay ID receives the money: one for all shops, or one per shop?
21. Who verifies slips? Is manual checking against the stored QR payload enough, or is paid automatic verification (a slip-check API) wanted?
22. If a slip shows the **wrong amount** (too little or too much), what happens? Ask for the difference, refund the excess, or reject the order?
23. If a buyer has paid but the item is out of stock (or the order is cancelled), how is the refund made, and who does it?
24. How long does a buyer have to pay before an unpaid order is cancelled and its stock released?
25. POS: is cash accepted on site, or PromptPay only? Does the POS need to record the buyer's name/phone, or is it anonymous? `purchases.users` is NULL for POS.
26. Are receipts or tax invoices needed?

## 6. Orders, shipping and after-sales
27. Which order states do staff need? The draft has `ORDERED → SHIPPING → ARRIVED`. Should it also have "waiting for payment", "paid / verified", "cancelled" and "refunded"? Who marks an order as arrived? `purchases.status`
28. Can a buyer change an order after placing it (size, colour, address)? Until when?
29. Is shipping always 60 ฿ per order? Is there a free-shipping threshold, or a self-pickup option?
30. Which carrier is used, and who enters the tracking ID? Is an order always one parcel, or can it be split (e.g. pre-order items shipped later)? `purchases.tracking_provider`, `tracking_id`
31. The return window ("XX วัน") and cancellation policy in the current form are unfilled placeholders. What are the actual rules?
32. Pre-orders: will any product be sold before it is made (like Keep It Secret's bake rounds)? If so, with what ship date?

## 7. Data
33. How long should buyer addresses and phone numbers be kept (PDPA)?
34. Which reports are needed: revenue per shop, per collection, per POS location, per event, or per day?
