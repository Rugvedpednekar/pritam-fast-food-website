var aiChatView = (function () {
  var page = document.createElement("section");
  page.className = "tw-ai";
  page.innerHTML = `
    <header class="tw-ai-toolbar">
      <h1>AI Assistant</h1>
      <button class="btn small tw-ai-clear" type="button">New chat</button>
    </header>
    <div class="panel tw-ai-panel">
      <div class="tw-ai-log" role="log" aria-label="Chat messages" aria-relevant="additions"></div>
      <div class="tw-ai-starters">
        <p class="sub">Ask about the selected outlet or how to use Tablewise.</p>
        <div class="tw-ai-prompts" role="group" aria-label="Suggested questions">
          <button class="btn small" type="button" data-question="How do I close the day?">Close the day</button>
          <button class="btn small" type="button" data-question="How much sales today?">Today’s sales</button>
          <button class="btn small" type="button" data-question="Any open bills?">Open orders</button>
          <button class="btn small" type="button" data-question="Give me a payroll overview">Payroll overview</button>
        </div>
      </div>
      <p class="tw-ai-status sub" role="status"></p>
      <form class="tw-ai-form" aria-label="Ask the AI assistant">
        <label for="tw-ai-question" class="tw-ai-label">Your question</label>
        <textarea id="tw-ai-question" class="input" rows="2" maxlength="1200" placeholder="Ask a question…" aria-describedby="tw-ai-note" required></textarea>
        <button class="btn primary" type="submit">Send</button>
      </form>
      <p class="help" id="tw-ai-note">Keep private business and personal details out of chat.</p>
    </div>`;

  var log = page.querySelector(".tw-ai-log");
  var starters = page.querySelector(".tw-ai-starters");
  var prompts = page.querySelector(".tw-ai-prompts");
  var status = page.querySelector(".tw-ai-status");
  var form = page.querySelector("form");
  var input = form.querySelector("textarea");
  var send = form.querySelector('button[type="submit"]');
  var clear = page.querySelector(".tw-ai-clear");
  var modelMessages = [];
  var busy = false;

  function appendMessage(role, text) {
    var message = document.createElement("article");
    message.className = "tw-ai-message" + (role === "user" ? " tw-ai-user" : "");
    var label = document.createElement("strong");
    label.textContent = role === "user" ? "You" : "Assistant";
    var body = document.createElement("p");
    body.textContent = text;
    message.append(label, body);
    log.append(message);
    log.scrollTop = log.scrollHeight;
    return message;
  }

  function updateControls() {
    send.disabled = busy || !input.value.trim();
    clear.hidden = !modelMessages.length && !input.value && !status.textContent;
    clear.disabled = busy;
    starters.hidden = busy || modelMessages.length > 0;
    log.hidden = !log.childElementCount;
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
    log.replaceChildren();
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
    status.textContent = "Looking up your answer…";
    var turn = { role: "user", text: question };
    var questionBubble = appendMessage(turn.role, turn.text);
    updateControls();
    log.scrollTop = log.scrollHeight;
    try {
      var intent = aiLiveData.quickIntent(question);
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
        var topic = aiLiveData.topic(intent);
        if (selected !== outletAtSubmit) throw Error("The selected outlet changed. Send your question again for this outlet.");
        reply = await aiLiveData.answer(intent);
        historyTurn = { role: "user", text: "Show me " + topic + " for the selected outlet." };
        historyReply = "Tablewise displayed " + topic + " from the app. The underlying figures are private.";
      }
      if (typeof reply !== "string" || !reply) throw Error("Could not get an answer. Try again.");
      modelMessages = modelMessages.slice(-8).concat(historyTurn, { role: "assistant", text: historyReply });
      appendMessage("assistant", reply);
      input.value = "";
      status.textContent = "";
    } catch (error) {
      questionBubble.remove();
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
  return function () { return page; };
})();
