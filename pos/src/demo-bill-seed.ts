import { businessDateFor, closeDueBusinessDays, parseRestaurantSnapshot } from "./day-end";
import type { SQL } from "bun";

const BATCH = "demo-400-2026-11-26";
const PER_OUTLET = 100;
const menu = [
  ["Pav Bhaji", 13500], ["Masala Dosa", 11500], ["Veg Fried Rice", 15500],
  ["Paneer Tikka", 22500], ["Plain Dosa", 9000], ["Idli Sambar", 8000],
  ["Veg Hakka Noodles", 16500], ["Club Sandwich", 14500], ["Misal Pav", 10500],
  ["Masala Chaas", 5000], ["Cold Coffee", 11500], ["Sweet Lassi", 9000],
] as const;

function currentDay(state, id: string, now: Date) {
  const existing = state.openDays[id];
  if (existing) return existing;
  const cfg = state.branchSettings[id] || {};
  const base = businessDateFor(now, cfg.autoDayEndEnabled ? cfg.autoDayEndTime : null);
  const latest = state.closings
    .filter(closing => closing.restaurantId === id && /^\d{4}-\d{2}-\d{2}$/.test(closing.day))
    .map(closing => closing.day).sort().at(-1);
  const day = latest && latest >= base ? new Date(Date.parse(latest) + 86400000).toISOString().slice(0, 10) : base;
  const opening = { id: id + "d" + state.seq++, date: day, opened: now.toISOString() };
  state.openDays[id] = opening;
  return opening;
}

function buildBill(state, outlet, outletIndex: number, index: number, day, number: number, now: Date) {
  const methodIndex = (index * 37 + outletIndex * 17) % 100;
  const channel = methodIndex < 52 ? "dine-in" : methodIndex < 79 ? "parcel" : "zomato";
  let random = (outletIndex + 1) * 2029 + index * 307;
  const pick = (limit: number) => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return (random >>> 16) % limit;
  };
  const remaining = menu.map((_, menuIndex) => menuIndex);
  const items = Array.from({ length: 1 + pick(4) }, () => {
    const [menuIndex] = remaining.splice(pick(remaining.length), 1);
    const [name, basePrice] = menu[menuIndex];
    const qty = 1 + pick(3);
    const price = basePrice + (channel === "zomato" ? 1500 : 0) + outletIndex * 500;
    const taxable = price * qty;
    const tax = Math.round(taxable * 0.025);
    return {
      id: "demo-menu-" + menuIndex, name, code: "DM" + (menuIndex + 1), qty, price,
      priceType: "exclusive", cgstBP: 250, sgstBP: 250,
      gross: taxable, discount: 0, taxable, cgst: tax, sgst: tax, total: taxable + tax * 2,
    };
  });
  const totalFor = (key: "taxable" | "cgst" | "sgst" | "total") => items.reduce((sum, item) => sum + item[key], 0);
  const total = totalFor("total"), split = Math.floor(total * 0.6);
  const payments = methodIndex < 41 + outletIndex * 4 ? [{ method: "UPI", amount: total }] :
    methodIndex < 57 + outletIndex * 3 ? [{ method: "Card", amount: total }] :
    methodIndex < 89 + outletIndex ? [{ method: "Cash", amount: total }] :
    methodIndex < 96 ? [{ method: "UPI", amount: split }, { method: "Cash", amount: total - split }] : [];
  const older = Math.min(Date.parse(day.opened), now.getTime());
  const time = new Date(now.getTime() - Math.floor((now.getTime() - older) * (99 - index) / 100)).toISOString();
  const sectionName = channel === "dine-in" ? "Dine-in" : channel === "parcel" ? "Parcel" : "Zomato";
  return {
    id: "b" + state.seq++, number: String(number), restaurantId: outlet.id,
    day: day.date, businessDate: day.date, businessDayId: day.id, time, status: "paid",
    type: channel === "dine-in" ? "dine-in" : "takeaway", channel, sectionName,
    tableName: channel === "dine-in" ? "Demo T" + (index % 10 + 1) : "",
    cashier: "Demo test", demoBatch: BATCH, items, payments,
    subtotal: totalFor("taxable"), taxable: totalFor("taxable"), discount: 0,
    cgst: totalFor("cgst"), sgst: totalFor("sgst"), roundOff: 0, total,
    issuer: { legalName: "Demo only — " + outlet.name, receiptWidth: 80 },
  };
}

export function seedBills(state, now = new Date()) {
  const outlets = state.restaurants.filter(outlet => outlet && outlet.active !== false);
  if (outlets.length !== 4) {
    return { status: "outlet_count_mismatch", outlets: outlets.map(outlet => ({ name: outlet.name, id: outlet.id })) };
  }
  const existing = state.bills.filter(bill => bill.demoBatch === BATCH);
  if (existing.length) {
    if (existing.length !== 400 || outlets.some(outlet => existing.filter(bill => bill.restaurantId === outlet.id).length !== PER_OUTLET)) {
      throw Error("An incomplete demo batch is already present. No bills were added.");
    }
    return { status: "already_seeded", count: existing.length };
  }
  if (!Number.isSafeInteger(state.seq) || state.seq < 1) throw Error("Invalid bill sequence.");
  closeDueBusinessDays(state, now);
  state.invoiceCounters ||= {};
  state.audit ||= [];
  const summary = outlets.map((outlet, outletIndex) => {
    const day = currentDay(state, outlet.id, now);
    if (!day?.id || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(Date.parse(day.opened)) ||
        state.closings.some(closing => closing.restaurantId === outlet.id &&
          (closing.dayId === day.id || closing.day === day.date))) throw Error("Could not determine an open business day.");
    const key = outlet.id + ":" + day.date;
    const prior = state.bills.filter(bill => bill.restaurantId === outlet.id && (bill.businessDate || bill.day) === day.date);
    const highest = prior.reduce((highest, bill) => {
      const number = Number(bill.number);
      return Number.isSafeInteger(number) ? Math.max(highest, number) : highest;
    }, Number(state.invoiceCounters[key]) || 0);
    if (!Number.isSafeInteger(highest + PER_OUTLET)) throw Error("Invalid invoice counter.");
    const bills = Array.from({ length: PER_OUTLET }, (_, i) => buildBill(state, outlet, outletIndex, i, day, highest + i + 1, now));
    state.invoiceCounters[key] = highest + PER_OUTLET;
    state.bills.push(...bills);
    const online = bills.filter(bill => bill.payments.some(entry => ["UPI", "Card"].includes(entry.method)));
    return { name: outlet.name, businessDay: day.date, count: bills.length, online: online.length,
      onlinePaise: online.reduce((sum, bill) => sum + bill.payments.filter(entry => ["UPI", "Card"].includes(entry.method)).reduce((n, entry) => n + entry.amount, 0), 0),
      missing: bills.filter(bill => !bill.payments.length).length, paise: bills.reduce((sum, bill) => sum + bill.total, 0) };
  });
  state.audit.push({ action: "demo_bills_seeded", batch: BATCH, count: 400, at: now.toISOString() });
  return { status: "seeded", count: 400, outlets: summary };
}

export async function runDemoBillSeed(db: SQL) {
  return await db.begin(async tx => {
    const rows = await tx.unsafe("SELECT payload::text AS payload FROM demo_snapshots WHERE account_key='owner' FOR UPDATE");
    if (!rows.length) return { status: "no_snapshot" };
    const state = parseRestaurantSnapshot(rows[0].payload);
    const result = seedBills(state);
    if (result.status !== "seeded") return result;
    const payload = JSON.stringify(state);
    if (Buffer.byteLength(payload) > 2_300_000) throw Error("The snapshot is too large to add the full batch safely.");
    await tx.unsafe("UPDATE demo_snapshots SET payload=$1::jsonb,version=version+1,updated_at=now() WHERE account_key='owner'", [payload]);
    return result;
  });
}
