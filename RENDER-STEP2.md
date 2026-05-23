# Step 2 — Put Spark on the internet (Render)

**What this does:** GitHub stores your files. Render **runs** Spark 24/7 and gives you a **link** teachers open on their phones.

You do this once.

---

## Before you start

- Step 1 done: files are on GitHub (no `.env` there)
- You still have `.env` on your computer with your real API key

---

## Part A — Make a Render account

1. Go to **https://render.com**
2. Click **Get Started** or **Sign Up**
3. Sign up with **GitHub** (easiest — connects to your repo automatically)
4. Click **Authorize** if GitHub asks permission

---

## Part B — Create the web service

1. On Render’s dashboard, click **New +** (top right)
2. Click **Web Service**
3. Find your **spark** repo (or whatever you named it) under GitHub
4. Click **Connect** next to it

If you don’t see your repo: click **Configure account** and allow access to that repository.

---

## Part C — Fill in the settings (important)

Render shows a form. Change only these:

| Field | What to put |
|-------|-------------|
| **Name** | `spark` (anything is fine) |
| **Region** | Pick closest to you (e.g. Singapore / Oregon) |
| **Branch** | `main` (leave default) |
| **Runtime** | **Node** |
| **Build Command** | **leave completely empty** |
| **Start Command** | `node server.js` |
| **Instance type** | **Free** |

Scroll down to **Environment Variables**.

Click **Add Environment Variable**:

| Key | Value |
|-----|--------|
| `ANTHROPIC_API_KEY` | Open your `.env` on your computer, copy everything **after** the `=` (the long `sk-ant-...` text) |

**Do not** put quotes around the key. Paste only the key value.

---

## Part D — Go live

1. Click **Create Web Service** (bottom)
2. Wait 2–5 minutes. You’ll see logs scrolling — that’s normal
3. When the top says **Live** (green), you’re done

---

## Part E — Get your teacher link

1. Near the top you’ll see a URL like:

   `https://spark-xxxx.onrender.com`

2. Click it (or copy it)
3. On **your phone**, open that link in Safari or Chrome
4. Try: topic `birds`, pick an age, **Generate**

If provocations appear → share that link with teachers.

---

## What to text teachers

See **SHARE-WITH-TEACHERS.md** — paste your real link where it says YOUR-LINK-HERE.

---

## If the first load is slow

Free Render “sleeps” when nobody uses it. First open after a while can take **30–60 seconds**. Wait, then refresh. Normal for free.

---

## If you see an error about API key

- Render → your **spark** service → **Environment** (left menu)
- Check `ANTHROPIC_API_KEY` exists and matches your `.env`
- Click **Save** → **Manual Deploy** → **Deploy latest commit**

---

## You’re done with Step 2

Step 3 is just: send the link. No new website to learn.
