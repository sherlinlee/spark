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
const newBtn = document.getElementById("new-btn");

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoading.hidden = !loading;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function fillList(element, items, ordered = true) {
  element.innerHTML = "";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    element.appendChild(li);
  });
}

function renderResults(data, topic, ageGroup) {
  const ageShort = ageGroup.match(/^(Toddlers|Nursery|K1|K2)/)?.[1] ?? ageGroup;
  resultsMeta.textContent = `${topic} · ${ageShort}`;

  fillList(envList, data.environmentProvocations);
  fillList(inquiryList, data.inquiryQuestions);
  fillList(materialsList, data.looseMaterials, false);
  anchorQuestion.textContent = data.anchorQuestion;

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const topic = document.getElementById("topic").value.trim();
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

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, ageGroup }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    renderResults(data, topic, ageGroup);
  } catch (err) {
    showError(err.message);
    resultsSection.hidden = true;
  } finally {
    setLoading(false);
  }
});

newBtn.addEventListener("click", () => {
  resultsSection.hidden = true;
  hideError();
  document.getElementById("topic").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
