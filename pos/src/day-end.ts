// Automatic business-day cutoff. All cutoffs use Asia/Kolkata (UTC+05:30).
// Pure functions allow us to test the dates without touching live data.
export const IST_OFFSET_MS = 330 * 60 * 1000;

export function validDayEndTime(time) {
  return typeof time === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

export function latestDayEndCutoff(now, time) {
  if (!validDayEndTime(time)) return null;
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const [hours, minutes] = time.split(":").map(Number);
  let instant = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hours, minutes) - IST_OFFSET_MS;
  if (instant > now.getTime()) instant -= 86400000;
  return new Date(instant);
}

export function businessDateFor(now, time) {
  if (!validDayEndTime(time)) {
    const local = new Date(now.getTime() + IST_OFFSET_MS);
    return local.toISOString().slice(0, 10);
  }
  const boundary = latestDayEndCutoff(now, time);
  return new Date(boundary.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function closeDueBusinessDays(state, now = new Date()) {
  const closed = [];
  if (!state || !state.openDays || !state.branchSettings || !Array.isArray(state.closings)) return closed;
  for (const restaurantId of Object.keys(state.openDays)) {
    const cfg = state.branchSettings[restaurantId] || {};
    if (cfg.autoDayEndEnabled !== true || !validDayEndTime(cfg.autoDayEndTime)) continue;
    const open = state.openDays[restaurantId];
    const boundary = latestDayEndCutoff(now, cfg.autoDayEndTime);
    const openedAt = Date.parse(open && open.opened);
    if (!open || !open.id || !Number.isFinite(openedAt) || openedAt >= boundary.getTime()) continue;
    // A previously closed day must not get another closing on retry.
    if (state.closings.some(c => c.dayId === open.id)) {
      delete state.openDays[restaurantId];
      closed.push(restaurantId);
      continue;
    }
    const bills = (state.bills || []).filter(b => b.restaurantId === restaurantId && b.businessDayId === open.id);
    const active = bills.filter(b => b.status === "paid");
    const cancelled = bills.filter(b => b.status === "cancelled");
    const sum = rows => rows.reduce((n,b) => n + (Number(b.total) || 0), 0);
    state.closings.push({
      restaurantId, day: open.date, dayId: open.id,
      gross: sum(bills), net: sum(active), cancelled: sum(cancelled),
      methods: {}, locked: true, automatic: true, 
      dayEndTime: cfg.autoDayEndTime, closedAt: boundary.toISOString()
    });
    if (!Array.isArray(state.audit)) state.audit = [];
    state.audit.push({
      action: "automatic_business_day_closed", restaurantId,
      dayId: open.id, at: boundary.toISOString()
    });
    delete state.openDays[restaurantId];
    closed.push(restaurantId);
  }
  return closed;
}
