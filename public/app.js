const form = document.getElementById("spark-form");
const submitBtn = document.getElementById("submit-btn");
const btnText = submitBtn.querySelector(".btn-text");
const btnLoading = submitBtn.querySelector(".btn-loading");
const errorBanner = document.getElementById("error-banner");
const resultsSection = document.getElementById("results");
const resultsMeta = document.getElementById("results-meta");
const envList = document.getElementById("env-list");
const inquiryList = document.getElementById("inquiry-list");
const materialsList = document.getElementById("materials-list");
const anchorQuestion = document.getElementById("anchor-question");
const envSetup = document.getElementById("env-setup");
const whereNext = document.getElementById("where-next");
const beforeSetup = document.getElementById("before-setup");
const beforeSetupText = document.getElementById("before-setup-text");
const newBtn = document.getElementById("new-btn");

// ── Loading messages ──────────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  "Gathering wonderment & curiosity… 🌿",
  "Thinking like a Reggio educator… 🏛️",
  "Listening to what children already know… 👂",
  "Following the child's question… 🔍",
  "Tuning into the hundred languages… 🌀",
  "Weaving observation into invitation… 🧵",
  "Almost there — finding the provocation… ✨",
];

let loadingMsgEl = null;
let loadingInterval = null;
let loadingMsgIdx = 0;

function startLoadingMessages() {
  // Create element if it doesn't exist
  if (!loadingMsgEl) {
    loadingMsgEl = document.createElement("p");
    loadingMsgEl.className = "loading-status";
    loadingMsgEl.setAttribute("aria-live", "polite");
    submitBtn.insertAdjacentElement("afterend", loadingMsgEl);
  }

  loadingMsgIdx = 0;
  loadingMsgEl.textContent = LOADING_MESSAGES[0];
  // Trigger fade-in on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => loadingMsgEl.classList.add("visible"));
  });

  loadingInterval = setInterval(() => {
    // Fade out
    loadingMsgEl.classList.remove("visible");
    setTimeout(() => {
      loadingMsgIdx = (loadingMsgIdx + 1) % LOADING_MESSAGES.length;
      loadingMsgEl.textContent = LOADING_MESSAGES[loadingMsgIdx];
      loadingMsgEl.classList.add("visible");
    }, 400);
  }, 2400);
}

function stopLoadingMessages() {
  clearInterval(loadingInterval);
  loadingInterval = null;
  if (loadingMsgEl) {
    loadingMsgEl.classList.remove("visible");
    setTimeout(() => {
      if (loadingMsgEl) loadingMsgEl.textContent = "";
    }, 400);
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoading.hidden = !loading;
  if (loading) {
    startLoadingMessages();
  } else {
    stopLoadingMessages();
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function fillList(element, items) {
  element.innerHTML = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    element.appendChild(li);
  });
}

function renderEnvSetup(setup) {
  if (!setup) return;
  envSetup.innerHTML = "";

  const fields = [
    { label: "Surface & Light", value: setup.surfaceAndLight, icon: "💡" },
    { label: "Arrangement", value: setup.arrangement, icon: "🗺️" },
    { label: "What to Remove", value: setup.whatToRemove, icon: "🚫" },
    { label: "Teacher Positioning", value: setup.teacherPositioning, icon: "🧘" },
  ];

  fields.forEach(({ label, value, icon }) => {
    if (!value) return;
    const div = document.createElement("div");
    div.className = "setup-item";
    div.innerHTML = `<strong>${icon} ${label}</strong><p>${value}</p>`;
    envSetup.appendChild(div);
  });

  if (setup.documentationPrompt) {
    const doc = setup.documentationPrompt;
    const docDiv = document.createElement("div");
    docDiv.className = "setup-item setup-doc";
    docDiv.innerHTML = `
      <strong>📋 Documentation Prompts</strong>
      <div class="doc-grid">
        <div><em>Words</em><p>${doc.words || ""}</p></div>
        <div><em>Body</em><p>${doc.body || ""}</p></div>
        <div><em>Return</em><p>${doc.return || ""}</p></div>
      </div>
    `;
    envSetup.appendChild(docDiv);
  }
}

function renderResults(data, topic, ageGroup) {
  const ageShort = ageGroup.match(/^(Toddlers|Nursery|K1|K2)/)?.[1] ?? ageGroup;
const topicDisplay = topic.charAt(0).toUpperCase() + topic.slice(1);
resultsMeta.textContent = `${topicDisplay} · ${ageShort}`;

  fillList(envList, data.environmentProvocations || []);
  fillList(inquiryList, data.inquiryQuestions || []);
  fillList(materialsList, data.looseMaterials || []);
  anchorQuestion.textContent = data.anchorQuestion || "";

  renderEnvSetup(data.environmentSetup);

  if (data.whereNext) {
    whereNext.textContent = data.whereNext;
    whereNext.closest("article").hidden = false;
  }

  if (data.beforeYouSetUp) {
    beforeSetupText.textContent = data.beforeYouSetUp;
    beforeSetup.hidden = false;
  }

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const topic = document.getElementById("topic").value.trim();
  const observation = document.getElementById("observation")?.value.trim() || "";
  const ageGroup = form.querySelector('input[name="ageGroup"]:checked')?.value;

  if (!topic) {
    showError("Please enter a topic.");
    return;
  }
  if (!ageGroup) {
    showError("Please select an age group.");
    return;
  }

  setLoading(true);
  resultsSection.hidden = true;
  beforeSetup.hidden = true;

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, ageGroup, observation }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.done && parsed.result) {
            renderResults(parsed.result, topic, ageGroup);
          }
        } catch (parseErr) {
          if (parseErr.message !== "Unexpected end of JSON input") {
            throw parseErr;
          }
        }
      }
    }

  } catch (err) {
    showError(err.message);
    resultsSection.hidden = true;
  } finally {
    setLoading(false);
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────────
newBtn.addEventListener("click", () => {
  resultsSection.hidden = true;
  beforeSetup.hidden = true;
  hideError();
  document.getElementById("topic").value = "";
  const obs = document.getElementById("observation");
  if (obs) obs.value = "";
  document.getElementById("topic").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
