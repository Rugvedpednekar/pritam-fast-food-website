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
        <p class="sub">Ask about billing, reports, or payroll.</p>
        <div class="tw-ai-prompts" role="group" aria-label="Suggested questions">
          <button class="btn small" type="button" data-question="How do I close the day?">Close the day</button>
          <button class="btn small" type="button" data-question="Where do I find sales reports?">Sales reports</button>
          <button class="btn small" type="button" data-question="How do I print a salary sheet?">Salary sheets</button>
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
  var messages = [];
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
    clear.hidden = !messages.length && !input.value && !status.textContent;
    clear.disabled = busy;
    starters.hidden = busy || messages.length > 0;
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
    messages = [];
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

    busy = true;
    input.readOnly = true;
    status.textContent = "Waiting for Gemini…";
    var turn = { role: "user", text: question };
    var questionBubble = appendMessage(turn.role, turn.text);
    updateControls();
    log.scrollTop = log.scrollHeight;
    try {
      var result = await cloudReq("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.slice(-8).concat(turn) }),
      });
      if (!result.ok || typeof result.body.reply !== "string") {
        throw new Error(result.body.error || "Could not get an answer. Try again.");
      }
      var answer = { role: "assistant", text: result.body.reply };
      messages = messages.slice(-8).concat(turn, answer);
      appendMessage(answer.role, answer.text);
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
