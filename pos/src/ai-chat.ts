const MODEL = "gemini-3.1-flash-lite";
const MAX_MESSAGES = 9;
const MAX_USER_CHARS = 1200;
const MAX_ASSISTANT_CHARS = 3200;
const MAX_BODY_BYTES = 48_000;

const APP_HELP = `You are the app-help assistant for Pritam Fast Food's Tablewise POS.
Answer app questions in a few clear steps, in the language of the question.
Use the workflows below as your source for app instructions. If there is not enough information, say so.
You can calculate totals, comparisons, and other arithmetic from fictional or sample figures explicitly supplied in the conversation. Use those figures exactly and label the result as sample data. Reuse the same sample figures for follow-up questions when asked. Before answering, check each sum and verify each difference by adding it back to the smaller value.
The signed-in app can show three live summaries for the currently selected restaurant. When the question asks for one, respond with the exact report token and nothing else:
LIVE_SALES_TODAY — total sales or bill count for the current business day.
LIVE_OPEN_ORDERS — current open bills, pending orders or open tables.
LIVE_PAYROLL_OVERVIEW — overview of the selected payroll month, including pay totals and advances.
Use a report token only for a matching request about the selected restaurant. You cannot retrieve other dates, other outlets, individual employee records, or arbitrary data. For those requests, explain what the app can show and direct the user to the relevant screen. Requests for instructions such as how to find reports, close the day, or print salary sheets should get normal app help. Never present sample figures as live records or invent figures, actions, shortcuts, or screens.
Keep replies concise and use plain text without Markdown formatting. Do not request passwords or personal details.

- New Bill opens Tables & Orders. Select a table for dine-in, or start a parcel with the parcel button or P. Use + Zomato for a Zomato order. Add items and complete the bill. Printing starts from the receipt's Print control.
- Bill History shows completed bills. Select the restaurant first when working with one outlet.
- Settings & Backup → Reports → Open Reports lets the owner choose a date range, view sales, export reports, and close the business day manually. Complete or void open orders first. Settings also contains Automatic Day End. Set a cutoff in India Standard Time and save it for the selected restaurant. Automatic day-end preserves open table and parcel orders. After either kind of closing, the next completed bill starts the next business day.
- Menu Management is where the owner maintains menu items, categories, and Excel menu imports. Settings & Backup → Manage Sections & Tables is where the owner manages dine-in sections and tables.
- Payroll → Attendance records days worked and monthly employee IDs. Payroll → Payment Sheets contains Print Salary Sheet. Payroll → Payroll History provides historical PDFs.
- Settings & Backup → Manage Restaurants is where the owner can manage outlets.
`;

type ChatMessage = { role: "user" | "assistant"; text: string };
type GeminiReply = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

function parseMessages(value: unknown): ChatMessage[] | undefined {
  if (!value || typeof value !== "object" || !("messages" in value)) return;
  const messages = value.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES || messages.length % 2 === 0) return;
  const parsed: ChatMessage[] = [];
  for (const [index, message] of messages.entries()) {
    const role = index % 2 === 0 ? "user" : "assistant";
    const maxChars = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (!message || message.role !== role || typeof message.text !== "string") return;
    const text = message.text.trim();
    if (!text || text.length > maxChars) return;
    parsed.push({ role, text });
  }
  return parsed;
}

export async function answerAppQuestion(request: Request, apiKey: string | undefined) {
  if (!apiKey) {
    console.warn("AI chat unavailable: GEMINI_API_KEY is missing");
    return { status: 503, body: { error: "The assistant is temporarily unavailable. Please try again later." } };
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return { status: 413, body: { error: "The conversation is too long. Start a new chat." } };
  }

  let messages: ChatMessage[] | undefined;
  try {
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) {
      return { status: 413, body: { error: "The conversation is too long. Start a new chat." } };
    }
    messages = parseMessages(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    return { status: 400, body: { error: "Invalid chat request." } };
  }
  if (!messages) return { status: 400, body: { error: "Enter a question of up to 1,200 characters." } };

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(18_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: APP_HELP }] },
        contents: messages.map(({ role, text }) => ({
          role: role === "assistant" ? "model" : "user",
          parts: [{ text }],
        })),
        generationConfig: { maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: "LOW" } },
      }),
    });
    if (response.status === 429) {
      return { status: 429, body: { error: "Gemini's usage limit has been reached. Try again later." } };
    }
    if (!response.ok) {
      console.warn("Gemini chat returned HTTP", response.status);
      return { status: 502, body: { error: "Gemini is unavailable. Try again shortly." } };
    }
    const data = await response.json() as GeminiReply;
    const reply = data.candidates?.[0]?.content?.parts
      ?.filter(part => !part.thought && typeof part.text === "string")
      .map(part => part.text)
      .join("")
      .trim();
    if (reply === "LIVE_SALES_TODAY" || reply === "LIVE_OPEN_ORDERS" || reply === "LIVE_PAYROLL_OVERVIEW") {
      return { status: 200, body: { intent: reply } };
    }
    if (reply) return { status: 200, body: { reply: reply.slice(0, MAX_ASSISTANT_CHARS) } };
    return { status: 422, body: { error: "Gemini could not answer that question. Try rephrasing it." } };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { status: 504, body: { error: "Gemini took too long to answer. Try again." } };
    }
    return { status: 502, body: { error: "Could not reach Gemini. Try again shortly." } };
  }
}
