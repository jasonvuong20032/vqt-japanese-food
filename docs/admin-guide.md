# Back office guide

For the store owner and staff. Open the back office at `/admin` on the website (for example http://localhost:5080/admin) and sign in with an account that has been given access.

The back office works on phones. Language and colour theme are switched in the top right corner, the same as in the store.

## Two access levels

| Task | Staff | Administrator |
|---|:-:|:-:|
| View the dashboard, process orders, print invoices | ✓ | ✓ |
| Add and edit dishes, photos, sections and categories | ✓ | ✓ |
| View customers, manage coupons, moderate reviews | ✓ | ✓ |
| View Policies & FAQ | ✓ | ✓ |
| Edit Policies & FAQ | | ✓ |
| Lock accounts, change roles, add or remove staff | | ✓ |
| Store settings (delivery fee, contact details, website address) | | ✓ |

When someone is locked out or loses their role, they lose access to the back office almost immediately (within about 30 seconds).

## Dashboard

The first screen after signing in:

- Revenue today and over 30 days (compared with the previous 30 days), number of orders and average order value. Cancelled and refunded orders are not counted.
- **Awaiting confirmation**: orders that need attention now. The same number appears next to **Orders** in the sidebar.
- A 30-day revenue chart. Click **Show table** to see the figures day by day.
- Best sellers, dishes running low, latest orders.

## Orders

The order list can be filtered by status and order date, and searched by order code, name or phone number. Click an order to open it.

**Orders move through a fixed sequence of statuses:**

```
Pending → Confirmed → Preparing → Out for delivery → Delivered → (Refunded)
   └──────────┴───────────┴─→ Cancelled
```

- **Preparing** can be skipped (straight from **Confirmed** to **Out for delivery**).
- An order can only be cancelled before it goes out for delivery. Cancelling **puts the items back in stock** and gives the coupon use back to the customer.
- Cash-on-delivery (COD) orders are marked as paid automatically when they move to **Delivered**.
- **Cancelled** and **Refunded** are final. The system always asks for confirmation before either step.

Every status change emails the customer in the language they ordered in. The **Note** field is saved in the order's progress and included in that email, so write it for the customer (for example "The driver will call 15 minutes before arriving").

**Print invoice** opens the browser's print dialog; choose "Save as PDF" if you need a file.

## Dishes

- Quick filters: Visible, Hidden, On sale, Running low, Out of stock. Sort by best selling, price or stock.
- Select several dishes to **hide, show or delete them in bulk**.

**Adding or editing a dish:**

1. Enter the **Vietnamese** name and descriptions first. The dish code and URL can be left empty; they are generated automatically.
2. Choose the category, price and stock quantity. To put a dish on sale, switch on **On sale** and enter the sale price.
3. Click **Create dish**. Photos can be uploaded once the dish exists (JPG, PNG or WebP, up to 5 MB, drag and drop works). The first photo is the cover; use the arrow buttons to reorder.
4. Translate into the other languages in the language tabs, or click **Translate with AI** to fill in drafts for all four languages (this button only appears when the server has a Claude API key, see the README). Review the text, then click **Save changes**. Any language left without a name shows the Vietnamese text to customers.

Two switches control availability:

- **Visible in the store**: switch off to hide the dish completely without deleting it.
- **Taking orders**: switch off to pause a dish (it stays visible but cannot be ordered).

If you leave the page with unsaved changes, the system asks before discarding them.

## Catalog

The menu has two levels: **sections** (for example "Sushi & Sashimi") contain **categories** (for example "Nigiri"). Lower **Order** numbers are shown first. A section can only be deleted once it has no categories, and a category once it has no dishes: move the dishes to another category first. The "Missing translations" label shows which languages still need a name.

## Customers

A list of accounts with their number of orders, total spent (cancelled and refunded orders excluded) and latest order. The detail page shows the address book, preferred language and recent orders.

Administrators can **lock an account** (the person is signed out on every device) or **change its role**. Nobody can lock or demote their own account.

Note: orders placed without signing in (guest orders) are not linked to any account, so they do not count towards a customer's orders.

## Coupons

Two discount types: **Percentage** (optionally capped with **Maximum discount**) or **Fixed amount**. A coupon can have a minimum order, a usage limit, and start and end dates.

Codes are 3–30 characters: capital letters, digits, `-` or `_`. The status column is calculated automatically: Running, Scheduled, Expired, Used up, Off. A deleted code cannot be created again with the same name; to pause a coupon, switch off **Enabled** instead.

## Reviews

Only customers who bought a dish can review it, and reviews are published straight away. Here you can **Hide**, **Restore** or **delete** them (several at once). The dish's average rating is recalculated automatically.

## Policies & FAQ

Entries here appear on the website's Policies & FAQ page: delivery, payment, cancellation, allergies… State conditions, times and costs clearly so customers know what to expect.

**Topic** is a short English keyword (`delivery`, `payment`, `cancel`, `allergy`…) used internally to group entries; customers don't see it. Translations work the same way as for dishes, including **Translate with AI**.

Staff can read this page; only administrators can change it.

## Settings (administrators only)

- Store name, phone, email, address, opening hours: shown in the site footer, on invoices and in customer emails.
- **Delivery fee** and **Free delivery from**: apply to new orders straight away.
- **Low-stock threshold**: dishes with stock at or below this number appear under **Running low** on the dashboard.
- **Website address**: the store's real address (for example `https://vqtjapanesefood.vn`). The "Track order" button in emails links here, so **set it correctly before going live**.

## Staff (administrators only)

To add a staff member, the person first **creates an account on the website**. Then enter their email, choose a role and click **Grant access**. To take access away, choose **Remove access (customer)**. Anyone whose role changes is signed out so the new role takes effect.

## Emails customers receive

Every email is sent in the customer's language (Vietnamese, English, Japanese, Korean or French), carries the store's name and contact details, and switches to a dark layout when the customer's mail app is in dark mode:

| Email | When |
|---|---|
| Order confirmation | As soon as the order is placed (if an email address was given) |
| Status update | Every time staff change the order status |
| Activation code | When a customer signs up or asks for a new code |
| Password reset code | When a customer clicks "Forgot password?" |
