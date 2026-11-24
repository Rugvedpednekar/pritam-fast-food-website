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

Payroll is a **browser-local demonstration** (no shared database or production payroll). It uses `localStorage` key `tablewise-payroll-demo-v3`. The existing employee data, attendance days and previous pay calculations are preserved during migration.

### Monthly attendance and staff IDs

- Open **Payroll → Attendance** and choose a payroll month. Assign each employee a **monthly ID / serial number from 1 to 100**. This number is separate from the permanent internal employee ID and **can change every month**.
- Each monthly ID must be unique within that month's employee records. The table sorts numerically ascending, with unassigned IDs last. Use the **All / 1–25 / 26–50 / 51–75 / 76–100 / Unassigned** filter to inspect a range.
- Next to the serial and employee name, you can view or edit **that month's salary** and enter **actual days worked** (0–30, half days permitted). Paid leave credit is **not** counted as attendance.
- Attendance and Salary Calculator read/write the same saved days. Press **Enter** in a monthly ID field to move to the **next employee’s monthly ID field**. Press Enter in Attendance’s salary field to move to that employee’s worked days; pressing Enter in the worked-days field advances to the next salaried employee’s worked-days input. Salary Calculator preserves the same days-to-next-days behavior.
- **Every month uses a fixed 30-day salary divisor**, including January and February. Calendar length does not change the formula.

### Salary changes and history

- Editing salary in **Employees → Edit** now has an **effective month**. Changes to monthly salary entered in **Attendance** also record a salary change with the month, previous salary, new salary and timestamp.
- **Employee → View → Salary Change History** lists the changes for later inspection. Saved earlier months keep their prior salaries. Existing browser data is migrated using old monthly snapshots when available; old monthly serial IDs are left empty, not invented.
- For each month, **Payroll History** shows the stored monthly ID, salary, days, leave pay, advances, and calculated net pay.
- In Payroll History, expand any month (including the current month) and choose **Download CASH PDF**, **Download CHEQUE PDF**, **Download Advances PDF**, **Download Attendance PDF**, or **Download Parcel Commissions PDF**. Downloads are PDF files; no CSV payroll downloads are offered. **Print CASH**, **Print CHEQUE**, and **Print Parcel Commissions** remain available. CASH and CHEQUE lists remain **separate**, each sorted ascending by its monthly IDs (unassigned IDs last).
- The main Payment Sheets page also uses these numeric monthly IDs and the same ascending ordering for CASH and CHEQUE separately.
- Deleting an employee hides them from active Payroll/Attendance without erasing earlier monthly data; Restore is available under Deleted Employees.

### Payroll designation shortcuts

The **Payroll → Settings → Designation Shortcuts** section lets restaurant owners maintain their own designation codes (for example `ek ch` → `Chinese Helper`, `kh` → `Kitchen Helper`, `hc` → `Head Chef`). There is no separate Designations tab. This section appears beneath the leave-policy settings, with fields to create shortcuts and an editable list. Existing default shortcuts are available as starting examples and can be renamed or deleted. Earlier saved custom shortcuts are preserved.

- Create shortcuts by entering a **shortcut code** and a **full designation**, then selecting **Add Designation**. Edit or delete any existing shortcut from the list. Codes are case-insensitive and duplicates are blocked. Removing a shortcut does not change existing employee designations.
- In **Payroll → Employees → Add/Edit**, enter the shortcut in the **Designation** field and press **Tab** or **Enter**, or use **Quick select designation**. Full designations are saved on the employee record.
- When the employee type is **Parcel Boy**, the Designation field and shortcut picker are hidden and disabled. New Parcel Boys automatically receive the **Parcel Boy** designation; editing a pre-existing Parcel Boy preserves their existing saved designation.
- Designation shortcuts are browser-local along with the rest of the payroll demo.

### Salaried employees and Parcel Boys (commission)

Under **Payroll → Employees → Add Employee**, choose **Salaried employee** (default) or **Parcel Boy (commission)**. Salaried employees keep the existing 30-day working salary, earned leave, advance, and fines calculation. Parcel Boys have no fixed salary or leave pay: the only amount subtracted from their commission is the GST percentage shown in their profile (default **5%**, editable when adding/editing the employee or in that month's commission editor). Employee type is locked after creation to protect prior monthly records.

In **Payroll → Attendance**, only salaried employees appear in the main days-worked table and its Enter-key sequence. Parcel Boys appear below in a separate compact section with monthly IDs and an **Enter Commission** button. The **30 daily rows do not open automatically**. Click a parcel boy to open the editor, then choose:

- **30 daily entries** — Day 1 through Day 30 and a commission amount per day, as in the supplied example. Each day is an amount of commission earned from bills, not total restaurant bill sales. You can leave some days blank.
- **Monthly total (default for new commission entries)** — enter one total commission amount instead of 30 rows. Switching between modes preserves each set of inputs separately and calculates from the selected mode only.

`GST deducted = round_to_paise(commission total × GST rate ÷ 100)`.

`Parcel Boy net payable = commission total − GST deducted`.

**Example:** Mukesh's sample has Day 1 ₹1,000, Day 2 ₹1,500, Day 3 ₹1,300, Day 4 ₹1,200, Day 5 ₹1,202 and Day 6–30 ₹1,000 each. That gives **₹31,202 commission − ₹1,560.10 GST (5%) = ₹29,641.90 payable**. This example is included for a fresh payroll-demo browser; already saved users must add their own parcel boys.

The parcel boy net amount feeds the ordinary Cash or Cheque payment sheet, sorted by monthly ID, and is also recorded in Payroll History. Download **Parcel Commissions PDF** for any month; the PDF includes the parcel payment summary and each employee’s selected daily or monthly-total commission entry, GST and net payable. Print parcel commission sheets from History. This is only a demonstration of an arithmetic deduction, not a determination of actual tax liability or GST treatment.

### Demo salary formula

For monthly salary **M**, monthly worked days **W**, employee paid leave cap **L**, and configured workdays-per-leave interval **R**:

`Working salary = round_to_paise(M × W ÷ 30)`

`Earned paid leave days = min(L, floor(W ÷ R))`

`Leave money = round_to_paise(M × earned leave days ÷ 30)`

`Net salary = max(0, working salary + leave money − entered advances − fines − other deductions)`

For example, with 27 worked days and R=7, a four-day allowance earns 3 additional paid leave days. A two-day allowance earns only two. Entered advances are deducted automatically; there are no Paid checkboxes.

This is not tax-compliant payroll. The calculations exclude PF, ESIC, income tax, overtime, banking transfers, and statutory leave policy checks. Browser-local data does not synchronize between devices and may be lost when local storage is cleared.

Run `bun test` in `pos/` for payroll, attendance sorting, salary-history and day-end regressions.

## Multiple restaurants

From **Settings → Manage Restaurants** add restaurants (up to 50 entries), remove one from the active workspace, or restore an archived restaurant. Removing a restaurant archives it, **not deletes it**: historical sales, staff, menus and audit records are preserved. At least one active restaurant is required. Open pending orders must be completed or voided before archiving.

## Zomato and phone navigation

On the POS floor screen the red **+ Zomato** button runs the existing New Parcel workflow and tags newly created parcel orders as Zomato. This is a channel label only; it is **not** connected to the Zomato ordering API. On phones, browser Back gestures follow the visible POS screens and return to Home rather than immediately abandoning billing. Native browser behavior can differ by mobile browser, so confirm on your specific device.

## Menu deletion control

Delete Full Menu appears next to the Categories filter in Menu Management. It is red, restaurant-scoped, protected by confirmation, and does not delete historical invoices.


## Sections & Tables

The **Sections & Tables** shortcut remains absent from the Workspace sidebar. To access this page, open **Settings & Backup → Manage Sections & Tables**.

Each section has a confirmed **Delete** action alongside Rename. Deletion archives the section and hides its linked tables rather than erasing historical bills or menu prices; **Deleted Sections → Restore** reactivates them. Deleting the final active section, a section with an open order, or a section containing an unsaved bill is blocked. The section changes continue using POS cloud sync.

### Payroll PDF downloads and Workspace navigation

**All payroll download buttons now produce PDF files, not CSV**: current Cash and Cheque sheets, current Advances and Attendance sheets, Parcel Boy commission payment sheets, and the same five sheet types for each month in Payroll History. A parcel-boy payment PDF contains a monthly summary and detailed commission pages (the chosen daily entries or monthly total) with GST and net pay. Printed Cash, Cheque, Advance and parcel sheets remain available where the UI provides a Print button. PDFs are created in the browser and downloaded without external services.

The old standalone **Workspace → Employees** sidebar shortcut has been removed. Staff and payroll records are accessed through **Payroll → Employees**. The legacy employee-directory code remains in the POS for compatibility but is not in the navigation.
