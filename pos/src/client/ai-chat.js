var aiChatView = (function () {
  var page = document.createElement("section");
  page.className = "tw-ai";
  page.innerHTML = `
    <header class="tw-ai-toolbar">
      <div class="tw-ai-heading"><span class="tw-ai-mark" aria-hidden="true">✦</span><h1>AI Assistant</h1></div>
      <button class="tw-ai-clear" type="button"><span aria-hidden="true">＋</span> New chat</button>
    </header>
    <div class="tw-ai-panel">
      <div class="tw-ai-log" role="log" aria-label="Chat messages" aria-relevant="additions" tabindex="0"></div>
      <div class="tw-ai-composer">
        <div class="tw-ai-starters">
          <p class="tw-ai-prompt-label" id="tw-ai-prompt-label">Quick actions</p>
          <div class="tw-ai-prompts" role="group" aria-labelledby="tw-ai-prompt-label">
            <button type="button" data-question="How much sales today?">Today’s sales</button>
            <button type="button" data-question="This month what is the total sales?">This month’s sales</button>
            <button type="button" data-question="Give me a payroll overview">Payroll overview</button>
            <button type="button" data-question="Any open bills?">Open orders</button>
            <button type="button" data-question="How do I close the day?">Close the day</button>
          </div>
        </div>
        <p class="tw-ai-status" role="status"></p>
        <form class="tw-ai-form" aria-label="Ask the AI assistant">
          <label for="tw-ai-question" class="tw-ai-label">Your question</label>
          <textarea id="tw-ai-question" rows="1" maxlength="1200" placeholder="Ask a question…" aria-describedby="tw-ai-note" required></textarea>
          <button class="tw-ai-send" type="submit">Send <span aria-hidden="true">↑</span></button>
        </form>
        <p class="tw-ai-note" id="tw-ai-note">Keep private business and personal details out of chat.</p>
      </div>
    </div>`;

  var log = page.querySelector(".tw-ai-log");
  var prompts = page.querySelector(".tw-ai-prompts");
  var status = page.querySelector(".tw-ai-status");
  var form = page.querySelector("form");
  var input = form.querySelector("textarea");
  var send = form.querySelector('button[type="submit"]');
  var clear = page.querySelector(".tw-ai-clear");
  var modelMessages = [];
  var previousReport = null;
  var busy = false;

  var reportLinks = {
    sales: ["reports", "▤", "Open sales reports"],
    orders: ["pos", "▦", "Open Tables & Orders"],
    payroll: ["payroll", "▥", "Open Payroll"],
  };

  function reportLink(kind) {
    var [route, symbol, title] = reportLinks[kind];
    var button = document.createElement("button");
    button.type = "button";
    button.className = "tw-ai-report";
    button.dataset.route = route;
    var icon = document.createElement("span");
    icon.className = "tw-ai-report-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = symbol;
    var name = document.createElement("span");
    name.textContent = title;
    var arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    button.append(icon, name, arrow);
    return button;
  }

  function appendMessage(role, text, report) {
    var row = document.createElement("article");
    row.className = "tw-ai-turn" + (role === "user" ? " tw-ai-turn-user" : "");
    row.setAttribute("aria-label", role === "user" ? "You" : "Assistant");
    if (role === "assistant") {
      var icon = document.createElement("span");
      icon.className = "tw-ai-avatar";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✦";
      row.append(icon);
    }

    var message = document.createElement("div");
    message.className = "tw-ai-message" + (role === "user" ? " tw-ai-user" : "");
    var body = document.createElement("p");
    if (report && reportLinks[report.kind]) {
      var firstBreak = text.indexOf("\n");
      var title = document.createElement("strong");
      title.className = "tw-ai-report-title";
      title.textContent = firstBreak < 0 ? text : text.slice(0, firstBreak);
      message.append(title);
      if (firstBreak >= 0) {
        body.textContent = text.slice(firstBreak + 1);
        message.append(body);
      }
      message.append(reportLink(report.kind));
    } else {
      body.textContent = text;
      message.append(body);
    }
    row.append(message);
    log.append(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  var greeting = appendMessage("assistant", "");

  function updateGreeting() {
    var text = "Hi! I can help with sales, open orders, and payroll for " + selectedName() + ". Pick a quick action below or ask a question.";
    var body = greeting.querySelector("p");
    if (body.textContent !== text) body.textContent = text;
  }

  function updateControls() {
    send.disabled = busy || !input.value.trim();
    clear.hidden = !modelMessages.length && !input.value && !status.textContent;
    clear.disabled = busy;
    prompts.querySelectorAll("button").forEach(function (button) { button.disabled = busy; });
    input.style.height = "auto";
    if (input.value) input.style.height = Math.min(input.scrollHeight + 2, 116) + "px";
  }

  prompts.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button || busy) return;
    input.value = button.dataset.question;
    updateControls();
    form.requestSubmit();
  });

  clear.addEventListener("click", function () {
    if (busy) return;
    modelMessages = [];
    previousReport = null;
    log.replaceChildren(greeting);
    log.scrollTop = 0;
    prompts.scrollLeft = 0;
    input.value = "";
    status.textContent = "";
    updateControls();
    input.focus();
  });

  input.addEventListener("input", updateControls);
  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!send.disabled) form.requestSubmit();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var question = input.value.trim();
    if (!question || busy) return;
    var outletAtSubmit = selected;

    busy = true;
    input.readOnly = true;
    status.classList.remove("tw-ai-error");
    status.textContent = "Looking up your answer…";
    var turn = { role: "user", text: question };
    var questionBubble = appendMessage(turn.role, turn.text);
    updateControls();
    log.scrollTop = log.scrollHeight;
    try {
      var intent = aiLiveData.quickIntent(question, previousReport);
      var reply;
      if (!intent) {
        var result = await cloudReq("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: modelMessages.slice(-8).concat(turn) }),
        });
        if (!result.ok) throw Error(result.body.error || "Could not get an answer. Try again.");
        intent = result.body.intent;
        reply = result.body.reply;
      }
      var historyTurn = turn;
      var historyReply = reply;
      if (intent) {
        var report = aiLiveData.parse(intent);
        if (!report) throw Error("I couldn’t match that to a live report. Try a date range such as this month or last month.");
        if (selected !== outletAtSubmit) throw Error("The selected outlet changed. Send your question again for this outlet.");
        reply = await aiLiveData.answer(report);
        previousReport = report;
        historyTurn = { role: "user", text: "Show a Tablewise report." };
        historyReply = "REPORT " + intent;
      }
      if (typeof reply !== "string" || !reply) throw Error("Could not get an answer. Try again.");
      modelMessages = modelMessages.slice(-8).concat(historyTurn, { role: "assistant", text: historyReply });
      appendMessage("assistant", reply, report);
      input.value = "";
      status.textContent = "";
    } catch (error) {
      questionBubble.remove();
      status.classList.add("tw-ai-error");
      status.textContent = error.message === "Failed to fetch" || error instanceof TypeError
        ? "Could not connect. Check your connection and try again."
        : error.message || "Could not reach the app. Try again.";
    } finally {
      busy = false;
      input.readOnly = false;
      updateControls();
    }
  });

  updateControls();
  return function () {
    updateGreeting();
    return page;
  };
})();
