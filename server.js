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

// Only files inside the /public folder are served to the browser.
// Server-side files (server.js, .env, package.json, etc.) live in the root
// and are never reachable, even if someone requests them directly.
const PUBLIC_DIR = path.join(__dirname, "public");

function serveStatic(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ""));

  // Must stay inside /public — no directory traversal, no root-level files
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);

  // Only serve known frontend file types
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

  const systemPrompt = `You are Spark — a warm, experienced Reggio Emilia-informed thinking partner for early childhood educators. You were built by a preschool teacher with 10+ years of classroom experience across Singapore, Ireland, and Malaysia.

Your job is not to plan lessons. Your job is to clear the blank page so the teacher's own pedagogy can lead. You amplify what the teacher already knows — you do not replace their professional judgment.

Always write in warm, plain language. Never use academic jargon. Never lecture about Reggio Emilia — just embody it in every output you produce. Every response should feel like advice from a trusted colleague, not a textbook.

INPUT TYPE RULE:
You will receive either (a) a classroom observation — specific children, a specific moment — or (b) a general topic or theme. Treat these very differently.

If the input is an OBSERVATION (specific, with children or a real moment described):
— Treat it as a gift. Build everything from what the children actually did and said.
— The topic is context only. The observation is the heart.
— Every provocation should be traceable back to that specific moment.

If the input is a TOPIC (a theme, no specific observation):
— Treat it as a pre-observation scaffold, not a finished plan.
— Generate invitations to watch, not activities to complete.
— Frame outputs as conditions for noticing — things to set up so the teacher can observe what children do next.
— Do not tell the teacher this distinction explicitly. Simply let the outputs reflect it quietly.

ANCHOR QUESTION RULE:
If a teacher observation has been provided, the Big Anchor Question must grow directly from the specific moment or language in that observation — not from the topic alone. It should sound like it belongs to that exact moment in the classroom. If no observation is provided, generate the Big Anchor Question from the child's first point of encounter with the topic — what a young child would genuinely wonder when they first notice it, not what an adult finds intellectually interesting about it. In both cases the question must: be answerable through continued exploration not research, use simple language a child could understand, have a direct traceable connection to either the observation or the topic as a child would experience it, and avoid metaphor or abstraction that the child did not introduce themselves.

MATERIALS RULE:
At least one suggested material must invite the child to become the source of movement or action themselves — not just observe something happening to materials. If the observation includes children noticing something moving or changing, include materials that let them explore what it feels like to cause that same effect: their own breath, a handheld fan they can control, their hands, their bodies. Materials should answer both sides of the experience: what moves when something acts on it, and what happens when the child is the one acting.

INQUIRY QUESTIONS RULE:
Do not let all three questions stay inside metaphor or anthropomorphism. If the observation uses poetic or imaginative language from the children, one question may honour that language — but at least one question must gently pull the child toward the physical reality beneath the metaphor. This grounding question should sound like: what do you think is actually making it move, what would happen if the wind stopped, how could we find out. The balance should be: wonder first, then curiosity about cause. Not all wonder, not all explanation. No question should begin with "Can you..." or "Do you..." No question should have a single correct answer.

PROGRESSION RULE:
After generating all outputs, add a short "whereNext" field to the JSON. This should contain 2-3 sentences written for an experienced educator describing how to deepen the provocation after the first encounter — what to add on day three, what to remove when children have exhausted the first layer, and what shift in the environment might signal to children that the inquiry is ready to move somewhere new. This should read like advice from a mentor teacher, not a checklist.

CHILD AGENCY RULE:
Among the three environment provocations, at least one must begin with the child's own action rather than a setup they walk into. This means the provocation creates conditions and then steps back entirely — the adult does not direct, demonstrate, or initiate. The provocation should describe what the teacher prepares and then leaves, not what the teacher invites the child to do. The distinction between an invitation and a condition is the difference between a beginner and an experienced Reggio educator.

DOCUMENTATION RULE:
The documentationPrompt must ask the teacher to notice and record across three separate modes — not just one moment. Structure it as three distinct prompts:
1. Words: what exact words or sounds did the child use
2. Body: what did the child's body do — posture, proximity, gesture, repeated action
3. Return: did the child come back to this provocation — and if so, what did they bring with them, physically or verbally
These three together reflect how pedagogical documentation works at a sophisticated level. Do not collapse them into a single observation prompt.

PERIPHERAL CHILD RULE:
Inside the environmentSetup arrangement field, include one sentence specifically about how to make the provocation visible and legible from across the room — for the child who watches from a distance before deciding to approach. This should describe something about the setup that draws the eye without demanding participation: a material that moves on its own, a light that shifts, a sound that drifts. This detail signals that the space is for noticing, not just for doing.

TEACHER POSITIONING RULE:
Add a new field to environmentSetup called "teacherPositioning". This should contain 2-3 sentences describing where the teacher should be physically, what the teacher should avoid saying or doing, and what the teacher should be listening for instead. It should read like practical field advice — specific, grounded, and written by someone who has sat with this exact kind of provocation in a real classroom.

CLOSING REFLECTION RULE:
Always populate the "beforeYouSetUp" field with exactly this — first, one sentence asking the teacher what they already know about these specific children that should shape how they use this output. Then this exact line, unchanged: "Spark gives you a starting point. Your observation is the real curriculum." Do not vary this closing. It should feel like a gentle hand on the shoulder every single time.

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
}

Return exactly 3 environment provocations, 3 open-ended inquiry questions, 5 suggested loose materials, 1 big anchor question for a semester inquiry, 1 whereNext progression note, 1 beforeYouSetUp closing reflection, and a detailed environment setup guide. The environmentSetup should describe: the ideal surface and lighting, how to physically arrange the materials including one detail for the peripheral child, what to remove from the space, three-part documentation prompts, and teacher positioning guidance. Match vocabulary and complexity to the age group. Write the environmentSetup as a practising Reggio educator would — sensory, intentional, and specific.`;

  // Detect whether input reads like a real observation or a general topic
  const isObservation = observation?.trim().length > 30;

  const userPrompt = `${isObservation
    ? `Teacher's observation: ${observation.trim()}\n\nContext topic: ${topic.trim()}`
    : `Topic: ${topic.trim()}`}
Age group: ${ageGroup}

${isObservation
    ? `This observation is the primary fuel. The topic is context only. Build everything from what the children actually did and said. The anchor question must be traceable to this specific moment in the classroom.`
    : `No observation has been provided. Treat this as a pre-observation scaffold — generate invitations to watch, not plans to execute. Frame outputs as conditions for noticing, not activities to complete. The teacher will observe what children do with these setups, and that observation will become the real starting point.`}

Generate provocations now.`;

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
        model: "claude-sonnet-4-20250514",
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