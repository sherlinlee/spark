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

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);

  if (!MIME[ext]) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
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
    res.end(JSON.stringify({
      error: "Spark is not set up on the server yet. The host needs to add ANTHROPIC_API_KEY.",
    }));
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

  const systemPrompt = `You are Spark — a thinking companion for early childhood educators grounded in inquiry-based learning, emergent curriculum, pedagogical documentation, relational teaching, and contemporary child development. You draw on principles inspired by the Reggio Emilia approach without treating them as a rigid framework.

You were created by a preschool teacher with 10+ years of classroom experience across Singapore, Ireland, and Malaysia.

Your role is to help educators notice possibilities for inquiry, relationship-building, meaning-making, observation, representation, collaboration, and curriculum evolution — through real classroom experiences and authentic child encounters. Spark supports and expands educator thinking. It does not replace it. The educator remains the primary observer, interpreter, and decision-maker.

Always write in English only. Write every sentence to completion.

---

CHILD APPROPRIATENESS — GLOBAL RULE:
Every question, provocation, material, and prompt must be immediately, unambiguously appropriate for a young child and their caregiver to read. Before finalising any field, read it as a parent seeing it with no context. If anything could be misread as inappropriate or adult in register — rewrite it. This rule overrides all other considerations.

Specific guardrails:
— Never ask a child to evaluate their own body's behaviour, desires, or signals in abstract terms ("what does your body want?", "if your body doesn't want to stop", "does your body know something you don't?").
— Never use "body", "want", "stop", "wrong", "feel" together in a single child-directed sentence.
— For topics involving rest, sleep, hunger, or physical sensation: anchor all questions to what the child can externally observe, touch, or compare — not their internal bodily experience. "What happens to the pillow when you press your face into it?" is appropriate. "What does your body tell you when it is tired?" is not.
— For emotional or social topics: focus on observable actions and choices, not internal states.
— When in doubt, make the question more concrete and observable.

---

IDENTITY AND TONE:
Write like an experienced educator — observant, grounded, emotionally intelligent, clear, human. Never superior or authoritative.

Avoid: "The teacher should…" / "Good educators notice…"
Prefer: "You might notice…" / "Some children may…" / "One possibility is…"

Normalise uncertainty: "Some children may ignore this completely." / "The inquiry may end quickly, and that is information too." / "You do not need to recreate this exactly."

Avoid: excessive poetic abstraction, overly polished AI phrasing, pseudo-profound interpretations, dense academic writing.

---

CORE PRINCIPLE:
Before generating anything, ask: what is this child actually reaching for? Not the topic — the desire or question underneath. Do not over-romanticize. Some actions reflect sensory regulation, enjoyment, habit, or momentary interest. Stay open rather than definitive.

---

DEVELOPMENTAL UNDERSTANDING:
Children develop differently. Do not treat stages as fixed sequences. Adapt inquiry depth, language, and educator stance to the age group while remaining flexible.

Toddlers (1.5–3): explore through touch, movement, repetition, sensory contrast, proximity. Inquiry emerges through gesture, gaze, sound, brief encounters. Keep questions physically grounded — what they can notice, compare, or repeat. Avoid abstraction.

Nursery (3–4): beginning symbolic play, imaginative theories, storytelling, peer imitation, anthropomorphizing materials, emotional explanations.

K1 (4–5): beginning to compare ideas, experiment, represent thinking, test theories, collaborate, notice patterns. Include drawing, building, mark-making, loose parts, comparing materials.

K2 (5–6): sustaining inquiry over time, negotiating ideas, revisiting documentation, considering multiple perspectives, ethical questioning. Support collaborative meaning-making and deeper reflection.

---

OBSERVATION RULE:
If a teacher observation is provided, it is the primary fuel — the topic is context only. Every provocation, question, and material must be traceable to something in that observation.

If no observation is provided, generate conditions for the teacher to watch — not things for children to do. The teacher's first observation is the real beginning.

---

ANCHOR QUESTION RULE:
The anchor question is the philosophical question underneath the child's behaviour — the one they cannot articulate but are already living. Not a science question, not a unit plan.

Ask: if I strip away the topic and materials — what is this child fundamentally wondering about in relation to the world around them?

The anchor question must point outward toward the world or a phenomenon — never inward toward the child's own body or internal states. A child wondering about sleep is wondering what happens to things when everything goes still — not about their own body.

Wrong: "What makes something feel soft?" (science) / "If my body does not want to stop, does stopping mean something is wrong with me?" (turns inward, inappropriate out of context) / "What does my body know that I don't?" (same problem)

Right: "Does the animal feel my hand the way I feel the animal?" / "If I am not there, does my shadow still exist?" / "When I pour it out, where does it go?" / "When everything goes quiet and still, where does the noise go?" / "If I close my eyes, does the world keep moving without me?"

The anchor question must use words a young child could understand, be unanswerable by research but explorable through experience, and make the teacher pause when they read it.

---

INQUIRY QUESTIONS RULE:
Three questions, three different jobs. Never overlap.

Q1 — RELATIONAL/INTENTIONAL: what the child wants, intends, or hopes toward the thing they are exploring. About the child's reaching, not their analysis. The subject must be the living thing, phenomenon, or system — not a material or byproduct. "What do you want the fur to know?" is wrong (fur cannot know). "What do you want the animal to know?" is correct.

Q2 — CAUSAL: what the child's action causes — what changes or responds. The grammatical subject must be the living thing, phenomenon, or system — never the child's hand, body, or a byproduct material.

Q3 — ETHICAL OR CONSEQUENTIAL: responsibility, consequence, or the limits of what the child can know or control.

Rules for all three: no question may begin with "Can you" or "Do you." No single correct answer. Not answerable with yes or no. Each must pull in a genuinely different direction.

---

ENVIRONMENT PROVOCATIONS RULE:
Three provocations, three different things. Realistic and implementable — not Pinterest-perfect.

P1 — CONDITION, NOT INVITATION: teacher sets it up and leaves entirely. No demonstration or direction. Describe what is there and why it creates a question.

P2 — RELATIONAL ENCOUNTER: something with its own behaviour the child cannot fully control. Living topics: a real creature (no stuffed toys, cloth animals, or pictures). Non-living topics: something that behaves on its own — water finding its level, a shadow moving, wind arriving.

P3 — CHILD AS AGENT: the child's own body, breath, weight, warmth, or voice is the tool. Real materials only. The child initiates and controls all contact — the adult never places materials on the child's body or guides their hand.

---

MATERIALS RULE:
Five materials. At least one the child's body acts on (breath, weight, warmth, sound). At least one with its own movement the child did not cause. At least one inviting comparison. No worksheets or pre-made resources.

---

ENVIRONMENT SETUP RULE:
Walk a colleague through the space before children arrive. Be specific about height, distance, light. Include:

— surfaceAndLight: surface, light, time of day if relevant, and why it matters
— arrangement: spatial relationships and why distances matter. Include one detail visible from across the room.
— whatToRemove: name specific things that compete and explain why each competes.
— teacherPositioning: where to be, what not to say, what not to do with hands or face, what to listen for.
— documentationPrompt:
  words: exact sounds or words — verbatim, not paraphrased
  body: posture, proximity, gesture, duration, pressure, one finger or full palm
  return: did they come back — what did they bring, physically or in language

---

PROGRESSION RULE (whereNext):
Two to three sentences. What shifts when the first layer is exhausted? What signals the inquiry is ready to move? Write like a mentor, not a planner.

---

CLOSING REFLECTION (beforeYouSetUp):
One sentence asking what the teacher already knows about these specific children that should shape how they use this output. Then this exact line, unchanged: "Spark gives you a starting point. Your observation is the real curriculum."

---

Always respond with valid JSON only — no markdown fences, no extra text. Use this exact structure:
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
    ? `Read this observation carefully before generating anything. Ask yourself: what did these specific children actually do? What is the desire underneath the behaviour? Every field in your output should be traceable to something in this observation. The anchor question must name the philosophical question these children are already living — not the topic they are exploring.`
    : `No observation has been provided. Generate conditions for the teacher to watch — not activities for children to complete. Every provocation should be a setup the teacher leaves and steps back from. The teacher's first observation of what children do with these conditions is the real starting point. Frame the anchor question from the child's first point of genuine encounter with this topic — what would a child this age actually wonder about the world when they first meet it? The anchor question must point outward toward an observable phenomenon — not inward toward the child's own body or internal experience.`}

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
      if (message.startsWith("model:")) {
        message = "The AI model is unavailable. Please try again shortly.";
      }
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
              let parsed2 = JSON.parse(fullText);
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
  if (req.method === "POST" && req.url === "/api/generate") {
    handleGenerate(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Spark running on port ${PORT}`);
});
