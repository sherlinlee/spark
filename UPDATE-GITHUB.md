# How to update GitHub after you change files (no Git)

**“Push”** = send your **new** files from your computer to GitHub so Render can show the latest Spark.

You only need to upload the files you **changed** (not the whole folder every time).

---

## What you changed recently?

Usually just these two:

- `index.html`
- `styles.css`

Never upload `.env`.

---

## Steps (about 5 minutes)

### 1. Open your repo on GitHub

1. Go to **https://github.com**
2. Log in
3. Click your **spark** repo (or whatever you named it)

### 2. Update each changed file

For **index.html**:

1. Click **`index.html`** in the file list
2. Click the **pencil icon** (top right) — **Edit this file**
3. On your computer, open `index.html` in Cursor or Notepad
4. Press **Ctrl+A** (select all) → **Ctrl+C** (copy)
5. On GitHub, **select all** in the editor → **paste** (replace everything)
6. Scroll down → **Commit changes**
7. In the small message box type: `Update title and header`
8. Click **Commit changes** (green)

Repeat for **styles.css** if you changed it:

1. Go back to the repo (click repo name at top)
2. Click **`styles.css`** → pencil → copy from your PC → paste → commit message `Update header styles` → **Commit changes**

### 3. Wait for Render (if you use Render)

Render usually updates **automatically** in 2–5 minutes.

1. Open **https://dashboard.render.com**
2. Click your **spark** service
3. Check it says **Deploying** then **Live**
4. Open your teacher link on your phone and refresh

---

## Even easier: upload one file at a time

If edit/paste feels scary:

1. On GitHub repo page → **Add file** → **Upload files**
2. Drag only `index.html` from your PC
3. GitHub will ask **“Replace existing file?”** → say **yes** / confirm replace
4. Commit with message `Update index`
5. Same for `styles.css` if needed

---

## Remember

| Do | Don’t |
|----|--------|
| Upload `index.html`, `styles.css` | Upload `.env` |
| Wait for Render to go Live | Expect instant change without refresh |

---

## Later: GitHub Desktop (optional)

If you update often, install **GitHub Desktop** — it has a big **Push origin** button instead of copy-paste. Not required.
