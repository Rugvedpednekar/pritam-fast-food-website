# Tablewise — Restaurant POS

This is the **Tables & Billing** restaurant POS application currently deployed as the Railway service `tablewise-demo`. It lives in `pos/` to keep the existing Pritam Fast Food public website at the repository root unchanged.

## Stack

- Bun + TypeScript (HTTP server / session authentication)
- Plain HTML, CSS and browser JavaScript (billing UI)
- PostgreSQL (versioned cloud snapshot of restaurant, menu, orders, bills and related data)
- Railway for hosting

## Layout

```text
pos/
  src/server.ts          Bun API, authentication and HTML composition
  src/client/index.html  POS base UI, styles and client behavior
  package.json           Start command
  .env.example           Names of required settings; no real credentials
  .gitignore
  railway.json
```

## Local development

1. Install Bun (modern version supporting `bun:sql`) and PostgreSQL.
2. From `pos/`, copy `.env.example` to `.env`.
3. Configure your own PostgreSQL `DATABASE_URL`, login account and generated scrypt password hash, and secure session secret.
4. The original Railway Function also injects **several JavaScript/CSS extension modules from Railway service variables**. The variable names are in `.env.example`. These extension **values are not available through the connected Railway integration** and **have not been committed**. Without those extension values, local startup will fail. To make this repo fully self-contained, export the *non-secret* extension source files separately and replace the environment injections with file imports.
5. Run `bun run start` (or `bun run dev`) and open the local port.

## Production deployment

The original Railway service uses a `Postgres` service and has the `DATABASE_URL`, authentication, and JavaScript/CSS extension variables already configured. **Do not overwrite/delete those variables or the Postgres service** during source migration. Set the Railway service Root Directory to `/pos` and Start Command to `bun run start` when connecting the existing service to GitHub `main`.

**Security:** Credentials, hashed passwords, auth tokens, production DB records and environment-variable values are intentionally excluded from GitHub. This repository is public; do not commit `.env` files.

## Legacy website

The root-level `index.html`, `menu.html`, `script.js`, `menu.js` and `style.css` remain the separate public-facing restaurant website. They were not replaced or moved.


## Automatic business day-end

In **Settings → Automatic Day End**, select a 24-hour cutoff time (India Standard Time), enable it and press **Save Day End Settings**. It is **disabled until you configure it** for each restaurant. The server checks enabled cutoffs about every 30 seconds and also before cloud reads/writes, even when nobody has the POS page open. After the cutoff it locks the old business day's bills but leaves pending table and parcel orders intact. The first completed bill after cutoff creates the next business day automatically.

Business days are named for the **date on which the shift began** (the most recent local cutoff). Historic bills retain their invoice IDs internally even though the Bills table shows only Date, Section, Amount, Status, Print and Cancel. Bills no longer record a payment method. If the Railway service is suspended, any missed cutoff is applied when the service runs and next accesses the database.

Test the cutoff logic locally from `pos/` using `bun test`.



## Restaurant Payroll Management Demo

The **Payroll** navigation item now opens a **complete, browser-local demo** rather than the old payroll preview. It does not use the Railway/PostgreSQL payroll state or finalize real salary payments. Sample data and edits are stored in browser localStorage under `tablewise-payroll-demo-v3`. Each device/browser has its own demo data, so changes do **not** sync across devices.

Within Payroll, navigate using the internal sections:

- **Dashboard:** total active employees, contractual monthly salary expense, all advances, estimated cash payroll, estimated cheque payroll
- **Employees:** add/view/edit staff with designation, joining date, restaurant, salary, CASH/CHEQUE method and locally saved resized photo
- **Advances (5th):** planned amounts, paid status, printable advance distribution sheet, fines and other deduction inputs
- **Salary Calculator (15th):** **only days worked** are entered, with half-days supported; earned salary and deductions are calculated automatically
- **Payment Sheets:** separate Cash and Cheque sheets, print and downloadable CSV, grand total and locally recorded salary-paid status
- **Payroll History:** prior months, paid advances, saved calculated salaries and payment status (previous months are seeded for demonstration)

**Demo payroll calculation (30-day basis):** `Gross = round(monthly salary in paise × days worked ÷ 30)`; `Net = max(0, Gross − advances actually marked paid − fines − other deductions)`. The 5th and 15th are display reminders, not enforced scheduling. All calculations round to the nearest paise. An unrecovered deduction is indicated when withholding exceeds gross pay.

This is an interactive demo, **not tax-compliant payroll**: statutory tax, PF, ESIC, overtime, year-end adjustments, reimbursements, and actual bank/cheque disbursements are not calculated or performed. Paid-status checkboxes record a local demonstration entry, not real transfers. Old `payrollDrafts` in cloud state are preserved but are not used by this demo.

Use `bun test` from `pos/` to run payroll calculation and existing business-day regression tests.

## Multiple restaurants

From **Settings → Manage Restaurants** add restaurants (up to 50 entries), remove one from the active workspace, or restore an archived restaurant. Removing a restaurant archives it, **not deletes it**: historical sales, staff, menus and audit records are preserved. At least one active restaurant is required. Open pending orders must be completed or voided before archiving.

## Zomato and phone navigation

On the POS floor screen the red **+ Zomato** button runs the existing New Parcel workflow and tags newly created parcel orders as Zomato. This is a channel label only; it is **not** connected to the Zomato ordering API. On phones, browser Back gestures follow the visible POS screens and return to Home rather than immediately abandoning billing. Native browser behavior can differ by mobile browser, so confirm on your specific device.

## Menu deletion control

Delete Full Menu appears next to the Categories filter in Menu Management. It is red, restaurant-scoped, protected by confirmation, and does not delete historical invoices.

