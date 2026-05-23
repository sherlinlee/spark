# Spark

A lesson provocation generator for early childhood educators. Enter a topic and age group, and Spark uses the Anthropic Claude API to suggest environment provocations, inquiry questions, loose materials, and a semester anchor question.

## Setup

1. [Install Node.js](https://nodejs.org/) (v18 or newer).

2. Copy the example env file and add your API key:

   ```bash
   copy .env.example .env
   ```

   Edit `.env` and set your key from [console.anthropic.com](https://console.anthropic.com/):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Start the server:

   ```bash
   node server.js
   ```

   Or: `npm start` if you use npm.

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Teachers on phones (share a link)

To let colleagues use Spark on phones **without installing Node**, put it online and send them one URL. Step-by-step guide: **[DEPLOY.md](DEPLOY.md)** (Render.com free hosting + optional “Add to Home Screen”).

## Why a small server?

The app UI is plain HTML, CSS, and vanilla JavaScript. A lightweight Node server (`server.js`) serves those files and proxies requests to Claude so your API key stays in `.env` and is never exposed in the browser.

## Age groups

- **Toddlers** — 18 months – 3 years
- **Nursery** — 3 – 4 years
- **K1** — 4 – 5 years
- **K2** — 5 – 6 years
