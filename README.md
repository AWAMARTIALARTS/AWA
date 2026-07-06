hi# All Walks Academy — Website + Booking Backend
  
This is a full booking system: a website, a shared live-availability database,
and Stripe payments that save a client's card so no-shows can be charged
afterwards.

## Adding a new category later
Prices and categories live in the `services` table in Supabase — add a new
row there (Table Editor → services) to add a new bookable option, no code
needed.
 
## Manual bookings
`admin.html` has an "Add a Booking Manually" form for phone/cash bookings.
These don't have a card saved, so no-shows on them must be charged another way.

## Important things to know
- No-show charging can occasionally require the customer to re-authenticate
  (a card network rule) — if that happens you'll see a clear message telling
  you to invoice them instead.
- 1-1/2-1/block slots hold 1 person; 4-1 group slots hold 4; academy classes
  default to capacity 12 — change these in Supabase to match your real setup.
- `admin.html` is protected by one shared passcode (ADMIN_PASSCODE), not
  individual logins — fine for a single studio.
