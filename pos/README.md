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

The **Payroll** navigation item opens a browser-local, interactive demonstration with six realistic employees and previous-month examples. All payroll information is saved only in this browser using `localStorage` under the existing key `tablewise-payroll-demo-v3`. It does **not** alter Railway/PostgreSQL employee data, restaurant invoices, or any real salary payment. Previous browser employee and advance data are retained.

### Features and workflow

- **Dashboard** — active employees, contractual monthly salary expense, advances entered, calculated Cash and Cheque salary totals.
- **Employees** — add, view, edit, and **delete** staff from the active roster with confirmation. Deleted employees disappear from active salary and attendance calculations and can be restored under **Deleted Employees**. Past monthly records remain intact. Employee details include name, photo, designation, joining date, restaurant, monthly salary, CASH/CHEQUE method, and **maximum paid leave days per month**. For example, set a four-day allowance for one employee and two for another; zero disables leave pay for an employee.
- **Attendance** — a **monthly** days-worked view, not a daily timesheet. Select a month using the Payroll month picker; enter 0–30 working days, including half-days. Attendance and Salary Calculator read/write **exactly the same** month-and-employee days field, so edits in either place appear in the other. **Earned paid leave days are not counted as attendance**.
- **Advances** — enter employee advance amounts, fines, and other deductions. **There is no Paid checkbox**: each entered advance is treated as distributed and deducted from salary. Set the amount to zero if no advance was given. Print or download an advance distribution sheet.
- **Salary Calculator** — enter **only days worked**, including half days (e.g., 22.5 or 27). **Press Enter to save the current employee’s days and focus/select the next employee’s days input** on desktop or phone; the last employee’s Enter saves without moving to another employee. Working salary, earned leave days, leave money, advances, and other deductions are calculated and displayed automatically.
- **Payment Sheets** — printable/downloadable Cash and Cheque sheets and a combined grand total. **There are no salary Paid checkboxes** or payment-status tracking.
- **History** — monthly salary, earned leave money, and advance figures, with example months available initially.
- **Settings** — configure how many working days earn one paid leave day (default: **1 leave day per 7 days worked**, valid intervals 1–30). The same settings are accessible from the main restaurant Settings page via a shortcut to Payroll Settings.

### Demo salary formula

For monthly salary **M** (in rupees), days worked **W**, employee maximum paid-leave allowance **L**, and configured workdays-per-leave rule **R**:

`Working pay = round_to_paise(M ÷ 30 × W)`

`Earned paid leave days = min(L, floor(W ÷ R))`

`Leave pay = round_to_paise(M ÷ 30 × earned paid leave days)`

`Net pay = max(0, working pay + leave pay − advance entered − fines − other deductions)`

Example: with **R = 7**, an employee working **27 days** earns **3 paid leave days** when their allowance is at least three. An employee capped at **2 paid leave days** earns only two. Leave pay is an **addition** to working pay.

Existing local demo records are migrated in place: employees without an allowance default to two leave days; a missing leave rule defaults to seven. Legacy paid/unpaid checkbox fields remain in the browser's stored data for compatibility but are no longer used.

**Important:** This is a demonstration, not a compliant payroll engine. No PF, ESIC, income tax, overtime, banking transactions, statutory leave entitlement, or final payroll authorization is implemented. Verify policy and calculations before using any figures for actual payments.

Run `bun test` from `pos/` to check payroll arithmetic, shared attendance data, delete/restore behavior, Enter navigation, UI rendering, and the existing business-day and restaurant validation.

## Multiple restaurants

From **Settings → Manage Restaurants** add restaurants (up to 50 entries), remove one from the active workspace, or restore an archived restaurant. Removing a restaurant archives it, **not deletes it**: historical sales, staff, menus and audit records are preserved. At least one active restaurant is required. Open pending orders must be completed or voided before archiving.

## Zomato and phone navigation

On the POS floor screen the red **+ Zomato** button runs the existing New Parcel workflow and tags newly created parcel orders as Zomato. This is a channel label only; it is **not** connected to the Zomato ordering API. On phones, browser Back gestures follow the visible POS screens and return to Home rather than immediately abandoning billing. Native browser behavior can differ by mobile browser, so confirm on your specific device.

## Menu deletion control

Delete Full Menu appears next to the Categories filter in Menu Management. It is red, restaurant-scoped, protected by confirmation, and does not delete historical invoices.

