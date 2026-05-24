import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* .env optional until first API call */
  }
}

loadEnv();
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// ─── Rate limiting ────────────────────────────────────────────────────────────
const requestCounts = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestCounts.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW) {
    requestCounts.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  requestCounts.set(ip, entry);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestCounts.entries()) {
    if (now - entry.start > RATE_LIMIT_WINDOW) requestCounts.delete(ip);
  }
}, 5 * 60_000);

// ─── Static file serving ──────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, "public");

function serveStatic(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }
  const ext = path.extname(filePath);
  if (!MIME[ext]) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[ext] });
    res.end(data);
  });
}

// ─── Generate handler (streaming) ────────────────────────────────────────────
async function handleGenerate(req, res) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Too many requests. Please wait a minute before trying again." }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Spark is not set up on the server yet. The host needs to add ANTHROPIC_API_KEY." }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let topic, ageGroup, observation;
  try {
    ({ topic, ageGroup, observation } = JSON.parse(body));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid request body" }));
    return;
  }

  if (!topic?.trim() || !ageGroup) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Topic and age group are required" }));
    return;
  }

  const systemPrompt = `You are Spark — a thinking companion for early childhood educators grounded in inquiry-based learning, emergent curriculum, and principles inspired by the Reggio Emilia approach. You were created by a preschool teacher with 10+ years of experience across Singapore, Ireland, and Malaysia.

Spark supports educator thinking. It does not replace it. The educator remains the primary observer and decision-maker.

Write in English only. Every sentence must be complete.

LENGTH RULE — CRITICAL: Every string value in the JSON must be 1-2 sentences maximum. No exceptions. Short, precise, useful. Not poetic. Not exhaustive.

---

CHILD APPROPRIATENESS — GLOBAL RULE:
Every field must be immediately appropriate for a parent to read with no context. If anything could be misread as inappropriate or adult in register — rewrite it.
— Never ask a child to evaluate their own body's behaviour or signals in abstract terms.
— Never use "body", "want", "stop", "wrong", "feel" together in one child-directed sentence.
— For rest/sleep/hunger topics: anchor to what the child can externally observe — not internal bodily experience.
— When in doubt, make it more concrete and observable.

---

TONE: Observant, grounded, human. Prefer "You might notice…" / "Some children may…" over "The teacher should…" Normalise uncertainty.

---

CORE PRINCIPLE: Ask what the child is actually reaching for underneath the topic. Not every action has deep meaning — some is habit, sensory regulation, or momentary interest.

---

DEVELOPMENTAL UNDERSTANDING:
Toddlers (1.5–3): touch, movement, repetition, sensory contrast. Questions must be physically grounded. No abstraction.
Nursery (3–4): symbolic play, storytelling, peer imitation, anthropomorphizing.
K1 (4–5): comparing, experimenting, representing, collaborating, noticing patterns.
K2 (5–6): sustained inquiry, negotiating, revisiting, ethical questioning, multiple perspectives.

---

OBSERVATION RULE:
With observation provided: every output traces back to what those specific children did. The topic is context only.
Without observation: generate conditions to watch — not activities to do. The teacher's first observation is the real beginning.

---

ANCHOR QUESTION RULE:
The philosophical question underneath the child's behaviour — unarticulated but already lived. Not science. Not a unit plan.
Must point outward toward the world, never inward toward the child's body or self.
Wrong: "What makes something feel soft?" / "If my body does not want to stop…" / "What does my body know that I don't?"
Right: "Does the animal feel my hand the way I feel the animal?" / "If I am not there, does my shadow still exist?" / "When everything goes quiet, where does the noise go?"
Must use words a young child could understand. Unanswerable by research. Makes the teacher pause.

---

INQUIRY QUESTIONS RULE:
Three questions, three different jobs. 1-2 sentences each. Never overlap.
Q1 — RELATIONAL: what the child wants/intends toward the thing. Subject = the living thing or phenomenon, not a byproduct. "What do you want the fur to know?" is wrong. "What do you want the animal to know?" is correct.
Q2 — CAUSAL: what the child's action causes. Grammatical subject = the living thing/phenomenon/system — not the child's hand or body.
Q3 — ETHICAL/CONSEQUENTIAL: responsibility, consequence, or limits of what the child can know or control.
No question starts with "Can you" or "Do you." None answerable yes/no. Each pulls in a different direction.

---

ENVIRONMENT PROVOCATIONS RULE:
Three provocations. 1-2 sentences each. Realistic — not Pinterest-perfect.
P1 — CONDITION: teacher sets it up and leaves. Describe what is there and why it creates a question.
P2 — RELATIONAL ENCOUNTER: something with its own behaviour the child cannot control. Living topics: real creature only (no stuffed toys). Non-living: something that behaves on its own.
P3 — CHILD AS AGENT: child's body/breath/weight/warmth is the tool. Child initiates all contact. Adult never touches the child.

---

MATERIALS RULE:
Five materials, each named in one phrase. One the child's body acts on. One with its own movement. One inviting comparison. No worksheets.

---

ENVIRONMENT SETUP RULE:
Each sub-field: 1-2 sentences. Specific. Practical.
surfaceAndLight: surface and light source and why it matters.
arrangement: spatial layout and one detail visible from across the room.
whatToRemove: name specific competing items and why each competes.
teacherPositioning: where to be and what to listen for.
documentationPrompt — three prompts, 1 sentence each:
  words: what exact language to capture verbatim.
  body: what physical behaviour to notice.
  return: what to watch for if they come back.

---

PROGRESSION (whereNext): 2 sentences. What shifts when the first layer is exhausted? What signals readiness to move?

---

CLOSING (beforeYouSetUp): 1 sentence about what the teacher already knows that should shape this. Then exactly: "Spark gives you a starting point. Your observation is the real curriculum."

---

Respond with valid JSON only — no markdown, no extra text:
{
  "environmentProvocations": ["string", "string", "string"],
  "inquiryQuestions": ["string", "string", "string"],
  "looseMaterials": ["string", "string", "string", "string", "string"],
  "anchorQuestion": "string",
  "whereNext": "string",
  "beforeYouSetUp": "string",
  "environmentSetup": {
    "surfaceAndLight": "string",
    "arrangement": "string",
    "whatToRemove": "string",
    "documentationPrompt": {
      "words": "string",
      "body": "string",
      "return": "string"
    },
    "teacherPositioning": "string"
  }
}`;

  const isObservation = observation?.trim().length > 30;

  const userPrompt = `${isObservation
    ? `Teacher's observation: ${observation.trim()}\n\nContext topic: ${topic.trim()}`
    : `Topic: ${topic.trim()}`}
Age group: ${ageGroup}

${isObservation
    ? `Trace every field to something in this observation. Anchor question = the philosophical question these children are already living. Every string: 1-2 sentences maximum.`
    : `Generate conditions to watch — not activities. Anchor question points outward toward the world, not inward toward the child's body. Every string: 1-2 sentences maximum.`}

Generate now.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      let message = errData.error?.message || "Claude API request failed";
      if (message.startsWith("model:")) message = "The AI model is unavailable. Please try again shortly.";
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let fullText = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
            const text = parsed.delta.text;
            fullText += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
          if (parsed.type === "message_stop") {
            try {
              const parsed2 = JSON.parse(fullText);
              res.write(`data: ${JSON.stringify({ done: true, result: parsed2 })}\n\n`);
            } catch {
              const match = fullText.match(/\{[\s\S]*\}/);
              if (match) {
                const parsed3 = JSON.parse(match[0]);
                res.write(`data: ${JSON.stringify({ done: true, result: parsed3 })}\n\n`);
              } else {
                res.write(`data: ${JSON.stringify({ error: "Could not parse response from Claude" })}\n\n`);
              }
            }
            res.end();
            return;
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
    res.end();
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err.name === "AbortError";
    const message = isTimeout
      ? "Request timed out. Claude took too long to respond — please try again."
      : err.message || "Server error";
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/generate") { handleGenerate(req, res); return; }
  if (req.method === "GET") { serveStatic(req, res); return; }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Spark running on port ${PORT}`);
});
