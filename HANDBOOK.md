# Operator Handbook — Event & Decoration Platform

A practical guide to how the system works, end to end. (Also available inside the
back office at **/admin/handbook**.)

## 1. What this is
A multi-company platform. One **back office** runs several event-decoration
companies. Each company has its own **branded 3D website** on its own domain, but
all share one back office, billing, and planning system.

## 2. Roles
| Role | Sees | Can do |
|------|------|--------|
| **Super-admin (group)** | All companies + consolidated reports | Create/edit companies, switch between them, everything below |
| **Company admin** | Only their company | Manage company settings, leads, quotes, invoices, planning |
| **Sales** | Only their company | Leads, quotations, invoices |
| **Planner** | Only their company | Planning dashboard |

Super-admins pick the company they're working in using the **company switcher**
(top-left of the back office).

## 3. The end-to-end flow
```
Customer visits 3D site → fills enquiry form → LEAD
   → staff open lead → build QUOTATION (AI or manual) → send
   → customer opens quote link → ACCEPT → pay deposit (DuitNow/bank) → upload proof
   → staff CONFIRM payment → BOOKING created + INVOICE issued + checklist seeded
   → PLANNING dashboard: tasks, suppliers, run-sheet, budget
   → event delivered
```

## 4. First-time setup (super-admin)
1. **Companies → New company.** Fill in: name, branding (logo/colours), SST
   (registered? + rate), bank details + DuitNow QR, default profit %, quote/invoice
   number prefixes, custom domain(s), and the OpenAI API key (for AI quoting).
2. Saving makes those details take effect everywhere for that company — its site,
   quotes, invoices and emails.

## 5. Handling an enquiry
1. A customer submits the **enquiry form** on the company site (event type, date &
   time, venue, theme, budget, purpose, reference images, special requests).
2. It appears in **Leads** with a reference number (e.g. `BLOOMQ-EVT-2026-0001`).
3. Open the lead to see all details + the customer's reference images.

## 6. Building a quotation (AI or manual)
1. On the lead, click **Create quotation**.
2. **AI mode:** click **Generate with AI** — it reads the reference images and the
   requirements, then writes a design plan, an analysed materials list (with
   estimated costs), clarifying questions, and ready-to-price line items.
3. **Manual mode:** add/edit lines yourself. Either way everything is editable.
4. Pricing: each line is `cost → profit % → selling price`. Set a **default profit %**
   and override any line. Toggle **SST** (follows the company setting, override per
   quote). Set the **deposit %**.
5. Click **Mark as sent** to share the quote link with the customer.

## 7. Quote → payment → invoice
1. Customer opens the public quote (`/q/<token>`), reviews items + demo images, and
   clicks **Accept**. A booking is created.
2. They see **deposit instructions** (DuitNow QR + bank details) and upload a
   **payment proof**.
3. Staff open **Bookings → the booking → Confirm payment**. This:
   - updates deposit/balance,
   - moves the booking into planning + **seeds the checklist**,
   - **issues a branded invoice** (per-company numbering + SST), viewable/printable
     under **Invoices**.

## 8. Planning an event
- **Planning** shows upcoming events with task progress.
- **Locations**: add/manage venues, then assign one to an event.
- **New event**: create an event manually (not every event needs a quote first).
- On an event's board: tick off **checklist tasks**, add **run-sheet** entries,
  add **suppliers** (with cost), and watch **budget vs actual** (value − supplier
  cost = margin). Edit date/status/location any time.

## 9. Reports (super-admin)
**Group reports** shows revenue, outstanding balances, leads, accepted quotes and
upcoming events — totals and a per-company breakdown, with **CSV export**.

## 10. Automation
A background worker sends queued emails (confirmations, quotes, invoices),
balance-due reminders, and moves past events to "executed". Email sending needs SMTP
configured; until then emails are queued/skipped safely.

## 11. Tips
- Add a new company anytime (super-admin) — its site plugs into the same back office.
- The AI needs an OpenAI key in the company's settings (or a server fallback key).
- All money is in **MYR (RM)**; SST follows each company's registration.
