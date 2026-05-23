# Put Spark online (for teachers on phones)

Once deployed, teachers only need **one link** in Safari or Chrome — no Node, no terminal.

You pay for Claude API usage from your Anthropic account (set a spending limit in the [Anthropic console](https://console.anthropic.com/) if you want a cap).

---

## Step 1 — Put your code on GitHub (one-time)

1. Create a free account at [github.com](https://github.com).
2. Create a new **private** repository (keeps your project name private; the API key still never goes in the repo).
3. Upload your `provocation-generator` folder, **without** the `.env` file (never upload `.env`).

If you use Git on your computer:

```powershell
cd C:\Users\sherl\OneDrive\Desktop\provocation-generator
git init
git add .
git commit -m "Spark provocation generator"
git remote add origin https://github.com/YOUR_USERNAME/spark.git
git push -u origin main
```

---

## Step 2 — Deploy on Render (free tier)

1. Sign up at [render.com](https://render.com) (free).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account and select the **spark** repository.
4. Settings:
   - **Name:** `spark` (or any name)
   - **Runtime:** Node
   - **Build command:** leave empty
   - **Start command:** `node server.js`
   - **Plan:** Free
5. Under **Environment Variables**, add:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** paste the same key from your local `.env`
6. Click **Create Web Service**.
7. Wait a few minutes until status is **Live**.

Your link will look like:

`https://spark-xxxx.onrender.com`

Copy that URL — that is what you share with teachers.

---

## Step 3 — Share with teachers

Send them:

1. The link (bookmark it).
2. Optional — **Add to Home Screen** so it feels like an app:
   - **iPhone:** open link in Safari → Share → **Add to Home Screen**
   - **Android:** Chrome menu → **Install app** or **Add to Home screen**

No App Store. No install from a computer.

---

## Free tier note

Render’s free service **spins down** after ~15 minutes of no use. The first open after a break may take **30–60 seconds** to wake up. For a small team that is usually fine; upgrade later if it annoys you.

---

## Updating Spark later

Push changes to GitHub; Render redeploys automatically.

After changing code locally, commit and push:

```powershell
git add .
git commit -m "Describe your change"
git push
```

---

## Quick checklist

| Step | Done? |
|------|--------|
| Code on GitHub (no `.env` in repo) | |
| Render web service created | |
| `ANTHROPIC_API_KEY` set in Render environment | |
| Live URL tested on your phone | |
| Link sent to teachers | |
