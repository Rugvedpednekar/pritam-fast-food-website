/* Live answers are computed in the signed-in browser. Chat history sent to Gemini
   contains a description of the report, never its figures or records. */
var aiLiveData = (function () {
  var businessDay;
  var payrollOverview;
  var topics = {
    LIVE_SALES_TODAY: "today's sales",
    LIVE_OPEN_ORDERS: "current open orders",
    LIVE_PAYROLL_OVERVIEW: "the payroll overview",
  };

  function quickIntent(question) {
    var normalized = question.toLowerCase().replace(/[?!.,]+$/g, "").replace(/\s+/g, " ").trim();
    if (/^(?:(?:what (?:are|were) |show me |how much (?:were )?)?(?:our )?(?:total )?sales today|today'?s sales|today's total sales)$/.test(normalized)) {
      return "LIVE_SALES_TODAY";
    }
    if (/^(?:(?:any|are there any|show(?: me)?|list) )?(?:open|pending) (?:bills|orders|tables)$/.test(normalized)) {
      return "LIVE_OPEN_ORDERS";
    }
    if (/^(?:(?:give|show) me (?:a |the )?)?payroll (?:overview|summary)$/.test(normalized)) {
      return "LIVE_PAYROLL_OVERVIEW";
    }
    return null;
  }

  function formatPayroll(outlet) {
    if (!payrollOverview) throw Error("Payroll is unavailable in this browser.");
    var summary = payrollOverview();
    var heading = "Payroll overview — " + outlet + " · " + summary.month;
    if (!summary.count) return heading + "\nThere are no active payroll records for this outlet in this browser.";
    var totals = summary.totals;
    return [
      heading,
      summary.count + " active staff · " + totals.ready + " of " + summary.count + " pay calculations ready",
      "Net payable so far: " + money(totals.grand) + " (Cash " + money(totals.cash) + " · Cheque " + money(totals.cheque) + ")",
      "Base monthly salaries: " + money(totals.base),
      "Advances recorded: " + money(totals.adv) + " · Deducted so far: " + money(totals.advPaid),
    ].join("\n");
  }

  async function answer(intent) {
    if (!Object.hasOwn(topics, intent)) throw Error("This live report is unavailable.");
    if (!cloudReady) throw Error("Sign in and let the restaurant data load first.");
    var restaurantId = selected;
    if (intent === "LIVE_PAYROLL_OVERVIEW") return formatPayroll(selectedName());
    var result = await cloudReq("/api/state");
    if (result.status === 401) throw Error("Your session expired. Sign in again to view live data.");
    if (!result.ok) throw Error("Could not load the latest restaurant data. Try again.");
    var snapshot = result.body.state;
    if (typeof snapshot === "string") snapshot = JSON.parse(snapshot);
    if (!valid(snapshot)) throw Error("There is no synchronized restaurant data available yet.");
    var outlet = snapshot.restaurants.find(function (restaurant) {
      return restaurant.id === restaurantId && restaurant.active !== false;
    });
    if (!outlet) throw Error("This outlet is no longer available. Select another outlet.");

    if (intent === "LIVE_OPEN_ORDERS") {
      var orders = (Array.isArray(snapshot.orders) ? snapshot.orders : []).filter(function (order) {
        return order.restaurantId === restaurantId && order.status === "open";
      });
      if (!orders.length) return outlet.name + " has no open orders.";
      var channels = { "Dine-in": 0, Parcel: 0, Zomato: 0 };
      orders.forEach(function (order) {
        var isZomato = [order.channel, order.source].some(function (value) {
          return String(value || "").toLowerCase() === "zomato";
        });
        var channel = isZomato ? "Zomato" : (order.tableId || order.type === "dine-in") ? "Dine-in" : "Parcel";
        channels[channel]++;
      });
      return outlet.name + " has " + orders.length + " open " + (orders.length === 1 ? "order." : "orders.") +
        "\n" + Object.keys(channels).map(function (channel) {
          return channel + ": " + channels[channel];
        }).join(" · ");
    }

    if (!businessDay) throw Error("Business-day sales are unavailable.");
    var day = businessDay(snapshot, restaurantId);
    var sales = stats(snapshot.bills.filter(function (bill) {
      return bill.restaurantId === restaurantId && (bill.businessDate || bill.day) === day;
    }));
    return [
      outlet.name + " — sales for " + pretty(day) + " (business day)",
      "Net sales: " + money(sales.net) + " across " + sales.count + " completed " + (sales.count === 1 ? "bill." : "bills."),
      "Cancelled bills: " + sales.cancelCount,
    ].join("\n");
  }

  return {
    setBusinessDay: function (calculate) { businessDay = calculate; },
    setPayrollOverview: function (calculate) { payrollOverview = calculate; },
    quickIntent: quickIntent,
    answer: answer,
    topic: function (intent) { return Object.hasOwn(topics, intent) ? topics[intent] : null; },
  };
})();
