# Upload Spark to GitHub (no Git commands)

Do this on a **computer** (not phone). Takes about 15 minutes the first time.

---

## Part A — Make a GitHub account

1. Go to **https://github.com**
2. Click **Sign up**
3. Follow the steps (email, password, verify)
4. You can use the **free** plan

---

## Part B — Create an empty “folder” on GitHub for your project

1. After you log in, click the **+** (top right) → **New repository**
2. Fill in:
   - **Repository name:** `spark` (or any name — no spaces)
   - **Description:** optional, e.g. `Lesson provocation generator`
   - Choose **Private** (recommended — only you see it; Render can still use it)
   - **Do NOT** check “Add a README” (leave the repo empty)
3. Click **Create repository**

You’ll see a page that says “…or upload an existing file” — that’s next.

---

## Part C — Upload your files from your PC

### Open your project folder

In File Explorer go to:

`C:\Users\sherl\OneDrive\Desktop\provocation-generator`

### On the GitHub page

1. Click **uploading an existing file** (or **Add file** → **Upload files**)
2. In File Explorer, press **Ctrl+A** to select everything in the folder
3. Hold **Ctrl** and **click `.env` once** to unselect it (it should no longer be highlighted)
4. **Drag** the remaining files into the GitHub browser window, **or** use “choose your files”

### STOP — only skip this file

| File | Why |
|------|-----|
| **`.env`** | Contains your secret API key — never upload this |

You do **not** need `.env.example` on GitHub. You will paste your API key into Render later (see DEPLOY.md).

### Finish the upload

1. At the bottom, in the box **“Add files via upload”**, type a short message: `First upload`
2. Click **Commit changes** (green button)

Wait until the page shows your files listed (index.html, server.js, etc.).

---

## Part D — Check it worked

1. On GitHub, you should see your files — click `index.html` to confirm it’s there
2. Confirm **`.env` is NOT in the list** (scroll the file list)

---

## You’re done with Step 1

Your code is on GitHub. Next step: **DEPLOY.md** (Render.com) to get a link for teachers’ phones.

---

## If upload is confusing — alternative: GitHub Desktop

1. Install **GitHub Desktop**: https://desktop.github.com/
2. Sign in with your GitHub account
3. **File → Add local repository** → choose `provocation-generator`
4. It may ask to create a repository — say yes, **private**
5. You’ll see changed files — **uncheck `.env`** if it appears
6. Write summary `First upload` → **Commit** → **Publish repository**

Never commit `.env` in GitHub Desktop either.
