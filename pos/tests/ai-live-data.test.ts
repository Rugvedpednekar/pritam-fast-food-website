import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/client/ai-live-data.js", import.meta.url), "utf8");
const template = readFileSync(new URL("../src/client/index.html", import.meta.url), "utf8");
const statsSource = template.match(/^stats=function\(rows\)\{[\s\S]*?^\};/m)?.[0];
if (!statsSource) throw Error("The POS sales totals function is missing.");

function mount({ authenticated = true } = {}) {
  const today = "2026-11-26";
  const snapshot = {
    restaurants: [{ id: "cv", name: "CV" }, { id: "pvt", name: "PVT" }],
    orders: [
      { restaurantId: "cv", status: "open", tableId: "1" },
      { restaurantId: "cv", status: "open", source: "Zomato" },
      { restaurantId: "cv", status: "void", source: "Zomato" },
      { restaurantId: "pvt", status: "open" },
    ],
    bills: [
      { restaurantId: "cv", businessDate: today, status: "paid", total: 1234500, items: [{ name: "Pav Bhaji", qty: 5 }] },
      { restaurantId: "cv", day: today, status: "cancelled", total: 99900, items: [{ name: "Dosa", qty: 12 }] },
      { restaurantId: "cv", day: "2026-11-25", status: "paid", total: 250000, items: [{ name: "Pav Bhaji", qty: 2 }, { name: "Dosa", qty: 4 }] },
      { restaurantId: "cv", day: "2026-11-02", status: "paid", total: 500000 },
      { restaurantId: "cv", day: "2026-10-31", status: "paid", total: 650000 },
      { restaurantId: "pvt", day: "2026-11-25", status: "paid", total: 800000 },
    ],
  };
  const requests: string[] = [];
  const live = new Function("selected", "selectedName", "cloudReady", "cloudReq", "valid", "today", "pretty", "money",
    `var stats; function paidForBill(){return [];} ${statsSource}\n${source}\nreturn aiLiveData;`)(
    "cv", () => "CV", true, async (path: string) => {
      requests.push(path);
      return { ok: authenticated, status: authenticated ? 200 : 401, body: { state: snapshot } };
    }, (value: unknown) => value === snapshot, () => today, (value: string) => value,
    (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount / 100),
  );
  live.setBusinessDay((_state: unknown, id: string) => id === "cv" ? today : "2026-11-25");
  live.setPayrollOverview((period: string, month: string) => ({
    month: month || period,
    count: 3,
    totals: { ready: 2, grand: 2650000, cash: 1500000, cheque: 1150000, base: 4500000, adv: 250000, advPaid: 200000, fines: 10000, other: 5000, leavePay: 150000 },
  }));
  return { live, requests };
}

test("Common owner questions route to the right report without a Gemini call", () => {
  const { live } = mount();
  const questions = [
    ["This month what is the total sales ?", "sales this_month selected summary"],
    ["What are our total sales today?", "sales today selected summary"],
    ["Today's sales", "sales today selected summary"],
    ["How much did we sell yesterday?", "sales yesterday selected summary"],
    ["What have we taken in so far this shift?", "sales today selected summary"],
    ["Could you pull turnover for the month of October 2026?", "sales dates selected summary 2026-10-01 2026-10-31"],
    ["Show last month's revenue", "sales last_month selected summary"],
    ["Total sales this week", "sales this_week selected summary"],
    ["How many completed bills last week?", "sales last_week selected summary"],
    ["What is our average bill for the last 7 days?", "sales last_7 selected summary"],
    ["Turnover in the past 30 days", "sales last_30 selected summary"],
    ["How many cancelled bills today?", "sales today selected summary"],
    ["Sales this year across all outlets", "sales this_year all summary"],
    ["Revenue last year", "sales last_year selected summary"],
    ["Compare this month vs last month sales", "sales month_compare selected summary"],
    ["Compare sales today and yesterday", "sales day_compare selected summary"],
    ["Compare this week and last week sales", "sales week_compare selected summary"],
    ["Sales between 2026-11-01 and 2026-11-15", "sales dates selected summary 2026-11-01 2026-11-15"],
    ["Sales on 2026-11-05", "sales dates selected summary 2026-11-05 2026-11-05"],
    ["Top-selling items this month", "sales this_month selected items"],
    ["Top 5 items last week at all outlets", "sales last_week all items"],
    ["Any open bills?", "orders selected summary"],
    ["How many pending Zomato orders?", "orders selected zomato"],
    ["Show open tables across all outlets", "orders all dine_in"],
    ["Any open parcel orders?", "orders selected parcel"],
    ["Give me a payroll overview", "payroll selected_month"],
    ["How much is our payroll this month?", "payroll this_month"],
    ["Salary advances last month", "payroll last_month"],
    ["Payroll in October 2026", "payroll month 2026-10"],
  ];
  for (const [question, expected] of questions) {
    expect(live.quickIntent(question, null), question).toBe(expected);
    expect(live.parse(expected)).toBeTruthy();
  }
});

test("Follow-ups retain the previous report and exact date scope", () => {
  const { live } = mount();
  const sales = live.parse("sales this_month all summary");
  expect(live.quickIntent("What about last month?", sales)).toBe("sales last_month all summary");
  expect(live.quickIntent("And all outlets?", live.parse("sales dates selected summary 2026-11-01 2026-11-15")))
    .toBe("sales dates all summary 2026-11-01 2026-11-15");
  expect(live.quickIntent("And last month?", live.parse("payroll this_month"))).toBe("payroll last_month");
});

test("Help, unsupported questions, named outlets and ambiguous date ranges avoid local totals", () => {
  const { live } = mount();
  for (const question of [
    "How do I close the day?", "How do I see payroll?", "Where are sales reports?", "Print the salary sheet",
    "What was the profit this month?", "Monthly sales for PVT", "Sales for the last 90 days",
    "Sales since Tuesday", "Top items by revenue", "Sales yesterday from Zomato", "How much did employee 17 receive?",
    "How many open bills yesterday?", "Can you forecast sales next month?", "Calculate sample sales of 500 and 400",
  ]) {
    expect(live.quickIntent(question, null)).toBeNull();
  }
  expect(live.parse("sales dates selected summary 2026-02-30 2026-03-01")).toBeNull();
  expect(live.parse("sales dates selected summary 2026-11-16 2026-11-01")).toBeNull();
  expect(live.parse("payroll month 2026-13")).toBeNull();
  expect(live.parse("sales this_month all delete")).toBeNull();
});

test("Month-to-date sales, comparisons and top items use completed bills from the right window", async () => {
  const { live, requests } = mount();
  const ask = (code: string) => live.answer(live.parse(code));
  expect(await ask("sales this_month selected summary")).toContain("₹19,845.00 across 3 completed bills");
  expect(await ask("sales this_month selected summary")).toContain("2026-11-01 to 2026-11-26");
  expect(await ask("sales this_month all summary")).toContain("₹27,845.00 across 4 completed bills");
  expect(await ask("sales today all summary")).toContain("PVT (2026-11-25): ₹8,000.00");
  expect(await ask("sales last_month selected summary")).toContain("₹6,500.00 across 1 completed bill");
  expect(await ask("sales this_week selected summary")).toContain("₹14,845.00 across 2 completed bills");
  expect(await ask("sales last_week selected summary")).toContain("₹0.00 across 0 completed bills");
  expect(await ask("sales month_compare selected summary")).toContain("₹13,345.00 higher");
  expect(await ask("sales dates selected summary 2026-11-01 2026-11-24")).toContain("₹5,000.00 across 1 completed bill");
  expect(await ask("sales this_month selected items")).toContain("1. Pav Bhaji — 7 sold\n2. Dosa — 4 sold");
  expect(requests.every((path) => path === "/api/state")).toBe(true);
});

test("Open orders are current and scoped; payroll totals stay browser-local", async () => {
  const { live, requests } = mount();
  expect(await live.answer(live.parse("orders selected summary"))).toContain("2 open orders");
  expect(await live.answer(live.parse("orders all summary"))).toContain("3 open orders");
  expect(await live.answer(live.parse("orders selected zomato"))).toContain("1 open Zomato order");
  const before = requests.length;
  const payroll = await live.answer(live.parse("payroll month 2026-10"));
  expect(payroll).toContain("2026-10");
  expect(payroll).toContain("2 of 3 pay calculations ready · 1 pending");
  expect(payroll).toContain("₹26,500.00");
  expect(requests).toHaveLength(before);
  const expired = mount({ authenticated: false }).live;
  await expect(expired.answer(expired.parse("sales this_month selected summary"))).rejects.toThrow("session expired");
});
