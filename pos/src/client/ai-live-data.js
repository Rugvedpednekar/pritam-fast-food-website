/* Compute live answers inside the signed-in app. Keep figures and records out of model history. */
var aiLiveData = (function () {
  var businessDay;
  var payrollOverview;
  var intervals = [
    ["month_compare", /\b(?:this month|month to date)\b.*\b(?:vs|versus|compared to|against|and)\b.*\blast month\b|\bcompare\b.*\bthis month\b.*\blast month\b/],
    ["week_compare", /\bthis week\b.*\b(?:vs|versus|compared to|against|and)\b.*\blast week\b|\bcompare\b.*\bthis week\b.*\blast week\b/],
    ["day_compare", /\btoday\b.*\b(?:vs|versus|compared to|against|and)\b.*\byesterday\b|\bcompare\b.*\btoday\b.*\byesterday\b/],
    ["last_month", /\b(?:last|previous) months?\b/],
    ["this_month", /\b(?:this months?|month to date|mtd|monthly)\b/],
    ["last_week", /\b(?:last|previous) weeks?\b/],
    ["this_week", /\b(?:this weeks?|week to date|wtd)\b/],
    ["last_7", /\b(?:last|past) (?:7|seven) days\b/],
    ["last_30", /\b(?:last|past) (?:30|thirty) days\b/],
    ["last_year", /\b(?:last|previous) years?\b/],
    ["this_year", /\b(?:this years?|year to date|ytd)\b/],
    ["yesterday", /\byesterdays?\b/],
    ["today", /\b(?:todays?|current (?:day|shift)|this shift)\b/],
  ];
  var comparison = { day_compare: ["today", "yesterday"], week_compare: ["this_week", "last_week"], month_compare: ["this_month", "last_month"] };
  var salesPeriods = new Set(intervals.map(function (p) { return p[0]; }).concat("dates"));
  var payrollPeriods = new Set(["selected_month", "this_month", "last_month", "month"]);
  var orderKinds = new Set(["summary", "dine_in", "parcel", "zomato"]);
  var paymentKinds = { online: "Online", cash: "Cash", upi: "UPI", card: "Card" };
  var monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + "T00:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function parse(code) {
    if (typeof code !== "string") return null;
    var parts = code.split(" "), [kind, period, scope, detail, from, to] = parts;
    if (kind === "sales" && salesPeriods.has(period) && ["selected", "all"].includes(scope) &&
        (["summary", "items", "payments"].includes(detail) || Object.hasOwn(paymentKinds, detail)) &&
        (!Object.hasOwn(comparison, period) || detail === "summary")) {
      if (period === "dates" ? parts.length === 6 && validDate(from) && validDate(to) && from <= to : parts.length === 4) {
        return { kind, period, scope, detail, from, to };
      }
    }
    if (kind === "orders" && parts.length === 3 && ["selected", "all"].includes(period) && orderKinds.has(scope)) {
      return { kind, scope: period, detail: scope };
    }
    if (kind === "payroll" && payrollPeriods.has(period) &&
        (period === "month" ? parts.length === 3 && validDate(scope + "-01") : parts.length === 2)) {
      return { kind, period, month: period === "month" ? scope : undefined };
    }
    return null;
  }

  function quickIntent(question, previous) {
    var q = question.toLowerCase().replace(/[’']/g, "").replace(/[?!.,]+$/g, "").replace(/\s+/g, " ").trim();
    // Leave instructions, hypothetical examples, edits and unsupported slices to app help.
    if (/\b(?:sample|fictional|hypothetical|forecast|projected|profit|expense|refund|discount|gst collected|stock|inventory|delete|edit|change|export|print|cancel a|close a|close the|how (?:do|can|should) (?:i|we)|where (?:do|can|is|are))\b/.test(q)) return null;
    var all = /\b(?:all|every|across|each) (?:\d+ )?(?:outlets?|restaurants?|branches?|locations?)\b|\b(?:outlet|branch) wise\b|\bby (?:outlet|branch)\b/.test(q);
    var scope = all ? "all" : "selected";
    var periodEntry = intervals.find(function (entry) { return entry[1].test(q); });
    var period = periodEntry && periodEntry[0];
    var dates = q.match(/\b\d{4}-\d{2}-\d{2}\b/g);
    var unknownPeriod = /\b(?:last|past|previous|next) \d+ (?:days|weeks|months|years)\b|\b(?:quarter|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(q);
    var monthMatch = /\b(january|february|march|april|may|june|july|august|september|october|november|december) (\d{4})\b/.exec(q);
    // A named day (for example 5 October 2026) needs the general date interpreter.
    var month = monthMatch && !/\d\s+$/.test(q.slice(0, monthMatch.index))
      ? monthMatch[2] + "-" + String(monthNames.indexOf(monthMatch[1]) + 1).padStart(2, "0") : null;
    var outletText = (month ? q.replace(monthMatch[0], "this month") : q).replace(/\btaken? in\b/g, "received");
    var mentionOutlet = /\b(?:at|for|in)\s+(?!my\b|our\b|the\b|this\b|last\b|previous\b|past\b|today\b|yesterday\b|all\b|each\b|every\b|\d{4}-\d{2}-\d{2}\b)[a-z]/.test(outletText);
    if (mentionOutlet) return null;
    var followUp = /^(?:and|what about|how about|same for)\s+/.test(q);
    var payroll = /\b(?:payroll|salary|salaries|staff payable|employee advances)\b/.test(q);
    var orders = /\b(?:open|pending|unbilled|occupied)\b/.test(q) && /\b(?:bills?|orders?|tables?|parcels?|zomato)\b/.test(q);
    var items = /\b(?:top|best|most)[ -]?(?:selling|sellers?|sold)\b|\b(?:top|best) (?:\d+ )?items\b|\bitems sold the most\b/.test(q);
    var hasPaymentWord = /\b(?:payments?|transactions?|paid|collections?|sales|bills?)\b/.test(q);
    var payment = hasPaymentWord && (
      /\b(?:online|digital|cashless)\b/.test(q) ? "online" :
      /\bupi\b/.test(q) ? "upi" : /\bcards?\b/.test(q) ? "card" :
      /\bcash\b/.test(q) ? "cash" : /\b(?:payments?|transactions?|collections?)\b/.test(q) ? "payments" : null);
    var sales = items || payment || /\b(?:sales|revenue|turnover|avg bill|average bill|cancelled bills?|canceled bills?|completed bills?)\b/.test(q) ||
      /\b(?:bill count|bills (?:did|have|were)|how many bills|how much (?:did|have) we (?:make|made|sell|sold|take in|taken in)|what have we taken in)\b/.test(q);

    if (payroll || (followUp && previous && previous.kind === "payroll" && (period || dates))) {
      if (all || (unknownPeriod && !month) || /\b(?:employee|person)\s+(?:#\s*)?\d+\b|\b(?:individual|who)\b/.test(q)) return null;
      if (month && !dates) return "payroll month " + month;
      if (dates && dates.length === 1) return "payroll month " + dates[0].slice(0, 7);
      if (!period || period === "this_month" || period === "last_month") return "payroll " + (period || "selected_month");
      return null;
    }
    if (orders || (followUp && previous && previous.kind === "orders" && all)) {
      if (period && period !== "today" || dates || unknownPeriod) return null;
      var detail = /\bzomato\b/.test(q) ? "zomato" : /\bparcels?\b/.test(q) ? "parcel" : /\b(?:dine[ -]?in|tables?)\b/.test(q) ? "dine_in" : "summary";
      return "orders " + scope + " " + detail;
    }
    if (sales || (followUp && previous && previous.kind === "sales" && (period || dates || all))) {
      if ((unknownPeriod && !period && !month) || (!dates && /\b(?:since|between|from)\b/.test(q)) ||
          /\b(?:zomato|parcel|dine[ -]?in)\b/.test(q) ||
          (items && /\bby (?:sales|revenue|amount|value)\b/.test(q))) return null;
      scope = all ? "all" : (followUp && previous && previous.kind === "sales" ? previous.scope : scope);
      var metric = payment || (items ? "items" : null) ||
        (followUp && previous && previous.kind === "sales" ? previous.detail : "summary");
      if (dates && dates.length <= 2) return "sales dates " + scope + " " + metric + " " + dates[0] + " " + (dates[1] || dates[0]);
      if (dates) return null;
      if (month) {
        var next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
        return "sales dates " + scope + " " + metric + " " + month + "-01 " + moveDay(next, -1);
      }
      if (followUp && all && !period && previous && previous.kind === "sales" && previous.period === "dates") {
        return "sales dates all " + previous.detail + " " + previous.from + " " + previous.to;
      }
      return "sales " + (period || (followUp && previous && previous.period) || "today") + " " + scope + " " + metric;
    }
    return null;
  }

  function moveDay(day, shift) {
    var date = new Date(day + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + shift);
    return date.toISOString().slice(0, 10);
  }

  function salesWindow(plan, activeDay, calendarDay) {
    switch (plan.period) {
      case "dates": return [plan.from, plan.to];
      case "today": return [activeDay, activeDay];
      case "yesterday": {
        var yesterday = moveDay(activeDay, -1);
        return [yesterday, yesterday];
      }
      case "last_7": return [moveDay(calendarDay, -6), calendarDay];
      case "last_30": return [moveDay(calendarDay, -29), calendarDay];
      case "this_week":
      case "last_week": {
        var weekday = new Date(calendarDay + "T00:00:00Z").getUTCDay();
        var monday = moveDay(calendarDay, -((weekday + 6) % 7));
        return plan.period === "this_week" ? [monday, calendarDay] : [moveDay(monday, -7), moveDay(monday, -1)];
      }
      case "this_month": return [calendarDay.slice(0, 7) + "-01", calendarDay];
      case "last_month": {
        var end = moveDay(calendarDay.slice(0, 7) + "-01", -1);
        return [end.slice(0, 7) + "-01", end];
      }
      case "this_year": return [calendarDay.slice(0, 4) + "-01-01", calendarDay];
      case "last_year": {
        var year = Number(calendarDay.slice(0, 4)) - 1;
        return [year + "-01-01", year + "-12-31"];
      }
    }
  }

  function formatWindow(range) {
    return range[0] === range[1] ? pretty(range[0]) : pretty(range[0]) + " to " + pretty(range[1]);
  }

  function formatPayroll(outlet, plan) {
    if (!payrollOverview) throw Error("Payroll is unavailable in this browser.");
    var summary = payrollOverview(plan.period, plan.month);
    var heading = "Payroll overview — " + outlet + " · " + summary.month;
    if (!summary.count) return heading + "\nThere are no payroll records for this outlet and month in this browser.";
    var totals = summary.totals;
    return [
      heading,
      totals.ready + " of " + summary.count + " pay calculations ready · " + (summary.count - totals.ready) + " pending",
      "Net payable: " + money(totals.grand) + " (Cash " + money(totals.cash) + " · Cheque " + money(totals.cheque) + ")",
      "Base monthly salaries: " + money(totals.base),
      "Advances recorded: " + money(totals.adv) + " · Deducted: " + money(totals.advPaid),
      "Other deductions: " + money(totals.fines + totals.other) + " · Paid leave: " + money(totals.leavePay),
    ].join("\n");
  }

  function formatOrders(snapshot, outlets, plan) {
    var labels = { dine_in: "Dine-in", parcel: "Parcel", zomato: "Zomato" };
    var counts = new Map(outlets.map(function (outlet) { return [outlet.id, { dine_in: 0, parcel: 0, zomato: 0 }]; }));
    (Array.isArray(snapshot.orders) ? snapshot.orders : []).forEach(function (order) {
      if (order.status !== "open" || !counts.has(order.restaurantId)) return;
      var zomato = [order.channel, order.source].some(function (value) { return /^zomato$/i.test(value || ""); });
      var kind = zomato ? "zomato" : (order.tableId || order.type === "dine-in") ? "dine_in" : "parcel";
      counts.get(order.restaurantId)[kind]++;
    });
    var keys = plan.detail === "summary" ? Object.keys(labels) : [plan.detail];
    function total(outlet) {
      return keys.reduce(function (sum, key) { return sum + counts.get(outlet.id)[key]; }, 0);
    }
    var count = outlets.reduce(function (sum, outlet) { return sum + total(outlet); }, 0);
    var heading = (plan.scope === "all" ? "All outlets" : outlets[0].name) + " — " + count + " open " +
      (labels[plan.detail] ? labels[plan.detail] + " " : "") + (count === 1 ? "order" : "orders");
    if (plan.scope === "all") return [heading].concat(outlets.map(function (outlet) { return outlet.name + ": " + total(outlet); })).join("\n");
    return heading + "\n" + keys.map(function (key) { return labels[key] + ": " + counts.get(outlets[0].id)[key]; }).join(" · ");
  }

  function topItems(rows) {
    var quantities = new Map();
    rows.filter(function (bill) { return bill.status === "paid"; }).forEach(function (bill) {
      (Array.isArray(bill.items) ? bill.items : []).forEach(function (line) {
        var name = String(line.name || "").trim();
        var quantity = Number(line.qty);
        if (!name || !Number.isFinite(quantity) || quantity <= 0) return;
        var key = name.toLowerCase(), item = quantities.get(key);
        if (item) item.quantity += quantity;
        else quantities.set(key, { name, quantity });
      });
    });
    return Array.from(quantities.values()).sort(function (a, b) {
      return b.quantity - a.quantity || a.name.localeCompare(b.name);
    }).slice(0, 5);
  }

  function salesRows(snapshot, outlets, plan, calendarDay) {
    var ranges = new Map(outlets.map(function (outlet) {
      return [outlet.id, salesWindow(plan, businessDay(snapshot, outlet.id), calendarDay)];
    }));
    var rows = snapshot.bills.filter(function (bill) {
      var window = ranges.get(bill.restaurantId);
      var date = bill.businessDate || bill.day;
      return window && date >= window[0] && date <= window[1];
    });
    var differentDates = new Set(Array.from(ranges.values()).map(function (window) { return window.join("/"); })).size > 1;
    return { rows, ranges, differentDates, label: differentDates ? "each outlet’s business day" : formatWindow(ranges.values().next().value) };
  }

  function classifyPayment(value) {
    var method = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (method === "cash") return "cash";
    if (/upi|gpay|googlepay|phonepe|bhim/.test(method)) return "upi";
    if (/card|visa|mastercard|rupay/.test(method)) return "card";
    if (/^(online|digital|netbanking|banktransfer|wallet|paytm|imps|neft|rtgs)$/.test(method)) return "digital";
    return method ? "other" : null;
  }

  function formatPayments(rows, heading, detail) {
    var totals = {};
    ["online", "cash", "upi", "card", "digital", "other"].forEach(function (key) {
      totals[key] = { transactions: 0, amount: 0 };
    });
    var unknown = 0, count = 0, onlineBills = 0;
    rows.forEach(function (bill) {
      if (bill.status !== "paid") return;
      count++;
      var entries = Array.isArray(bill.payments) && bill.payments.length ? bill.payments :
        bill.payment ? [{ method: bill.payment, amount: bill.total }] : [];
      var recorded = false, online = false;
      entries.forEach(function (entry) {
        var kind = classifyPayment(entry && entry.method), amount = Number(entry && entry.amount);
        if (!kind || !Number.isFinite(amount) || amount <= 0) return;
        recorded = true;
        totals[kind].transactions++;
        totals[kind].amount += amount;
        if (kind === "upi" || kind === "card" || kind === "digital") {
          online = true;
          totals.online.transactions++;
          totals.online.amount += amount;
        }
      });
      if (!recorded) unknown++;
      if (online) onlineBills++;
    });
    function line(key, name) {
      var total = totals[key];
      return name + ": " + total.transactions + " recorded " + (total.transactions === 1 ? "payment" : "payments") + " · " + money(total.amount);
    }
    var lines = [heading];
    if (detail === "payments" || detail === "online") {
      lines.push(line("online", "Online") + " across " + onlineBills + " " + (onlineBills === 1 ? "bill." : "bills."));
      lines.push(line("upi", "UPI"), line("card", "Card"));
      if (totals.digital.transactions) lines.push(line("digital", "Other digital"));
      if (detail === "payments") lines.push(line("cash", "Cash"), line("other", "Other recorded methods"));
    } else {
      lines.push(line(detail, paymentKinds[detail]));
    }
    if (!count) lines.push("No completed bills in this period.");
    else if (unknown) lines.push(unknown + " of " + count + " completed bills have no recorded payment method.");
    return lines.join("\n");
  }

  function formatSales(snapshot, outlets, plan) {
    if (!businessDay) throw Error("Business-day sales are unavailable.");
    var calendarDay = today();
    var name = plan.scope === "all" ? "All outlets" : outlets[0].name;
    var periods = comparison[plan.period];
    if (periods) {
      var report = periods.map(function (period) {
        var result = salesRows(snapshot, outlets, Object.assign({}, plan, { period }), calendarDay);
        return { label: result.label, rows: stats(result.rows) };
      });
      var difference = report[0].rows.net - report[1].rows.net;
      return [name + " — sales comparison",
        (report[0].label === report[1].label ? "Current period · " : "") + report[0].label + ": " + money(report[0].rows.net),
        (report[0].label === report[1].label ? "Previous period · " : "") + report[1].label + ": " + money(report[1].rows.net),
        difference === 0 ? "Sales were equal." : "Net sales were " + money(Math.abs(difference)) + (difference > 0 ? " higher." : " lower."),
      ].join("\n");
    }

    var result = salesRows(snapshot, outlets, plan, calendarDay);
    if (plan.detail === "payments" || Object.hasOwn(paymentKinds, plan.detail)) {
      return formatPayments(result.rows, name + " — payments · " + result.label, plan.detail);
    }
    var totals = stats(result.rows);
    var heading = name + " — " + (plan.detail === "items" ? "top items by quantity" : "sales") + " · " + result.label;
    if (plan.detail === "items") {
      var top = topItems(result.rows);
      return [heading].concat(top.length ? top.map(function (item, index) {
        return (index + 1) + ". " + item.name + " — " + item.quantity + " sold";
      }) : ["No item quantities were recorded for completed bills in this period."]).join("\n");
    }
    var lines = [
      heading,
      "Net sales: " + money(totals.net) + " across " + totals.count + " completed " + (totals.count === 1 ? "bill." : "bills."),
      "Cancelled bills: " + totals.cancelCount + " · Cancelled amount: " + money(totals.cancelled),
    ];
    if (totals.count) lines.push("Average completed bill: " + money(Math.round(totals.net / totals.count)));
    var breakdown = plan.scope === "all" ? outlets.map(function (outlet) {
      var row = stats(result.rows.filter(function (bill) { return bill.restaurantId === outlet.id; }));
      return { outlet, row };
    }).sort(function (a, b) { return b.row.net - a.row.net; }) : [];
    breakdown.forEach(function ({ outlet, row }) {
      lines.push(outlet.name + (result.differentDates ? " (" + formatWindow(result.ranges.get(outlet.id)) + ")" : "") +
        ": " + money(row.net) + " · " + row.count + " completed");
    });
    return lines.join("\n");
  }

  async function answer(plan) {
    if (!cloudReady) throw Error("Sign in and let the restaurant data load first.");
    var restaurantId = selected;
    if (plan.kind === "payroll") return formatPayroll(selectedName(), plan);
    var result = await cloudReq("/api/state");
    if (result.status === 401) throw Error("Your session expired. Sign in again to view live data.");
    if (!result.ok) throw Error("Could not load the latest restaurant data. Try again.");
    var snapshot = result.body.state;
    if (typeof snapshot === "string") snapshot = JSON.parse(snapshot);
    if (!valid(snapshot)) throw Error("There is no synchronized restaurant data available yet.");
    var outlets = snapshot.restaurants.filter(function (outlet) {
      return outlet.active !== false && (plan.scope === "all" || outlet.id === restaurantId);
    });
    if (!outlets.length) throw Error("This outlet is no longer available. Select another outlet.");
    return plan.kind === "orders" ? formatOrders(snapshot, outlets, plan) : formatSales(snapshot, outlets, plan);
  }

  return {
    setBusinessDay: function (calculate) { businessDay = calculate; },
    setPayrollOverview: function (calculate) { payrollOverview = calculate; },
    quickIntent: quickIntent,
    parse: parse,
    answer: answer,
  };
})();
