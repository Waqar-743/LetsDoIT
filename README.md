<div align="center">

<img src="assets/img/app-icon.svg" alt="LetsDoIT" width="140" height="140" />

<br />

**Hybrid Offline / Online Classroom AI — built for real classrooms, not demo slides.**

<br />

[![Release](https://img.shields.io/github/v/release/Waqar-743/LetsDoIT?style=flat-square)](https://github.com/Waqar-743/LetsDoIT/releases)
[![License](https://img.shields.io/badge/license-project%20owner-lightgrey?style=flat-square)](#license)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6?style=flat-square&logo=windows)](https://github.com/Waqar-743/LetsDoIT/releases)

</div>

---

## Download (Windows)

Install the latest desktop build from **GitHub Releases** (no Node/Rust required for end users):

| Package | File | Use when |
|---------|------|----------|
| **NSIS setup** (recommended) | `LetsDoIT_0.1.0_x64-setup.exe` | Standard Windows install wizard |
| **MSI** | `LetsDoIT_0.1.0_x64_en-US.msi` | Managed / enterprise install |

→ **[Latest release & installers](https://github.com/Waqar-743/LetsDoIT/releases/latest)**

After install, open **LetsDoIT Classroom**, then configure Online and/or Offline AI under the **Model** tab.

---

## The story behind the name

**LetsDoIT** started from a simple frustration shared across many Pakistani colleges and universities:

> Wi‑Fi drops mid-lecture. Load-shedding kills the router. Cloud-only AI demos look great in pitch decks — and fail the moment students need them most.

So the product goal became personal and practical:

- **Teachers** upload notes/PDFs, issue quizzes, and track enrollment — without five separate tools.
- **Students** join with a 4-digit code, open materials, ask a real AI tutor, and practice with quizzes grounded in **their** documents.
- **AI** is real inference — **not** scripted dummy text — with a clear path between **Online (OpenRouter + free Google AI Studio fallback)** and **Offline (local Hugging Face GGUF)**.

The name is a promise: stop waiting for perfect connectivity. **Let’s do it** with a hybrid classroom assistant that respects the network you actually have.

---

## What LetsDoIT is

LetsDoIT is an **offline-first hybrid AI classroom desktop app** with two portals under one roof:

| Portal | Who it’s for | What they can do |
|--------|----------------|------------------|
| **Teacher** | Instructors & lab staff | Create courses, share 4‑digit join codes, upload PDFs/notes, **Summarize with Model**, generate real AI quizzes, monitor activity |
| **Student** | Learners | Join courses, see live material updates, **Document Summary**, **Practice Quiz** (easy / moderate / hard), RAG chat, save quiz scores |

Under the hood, a single **Auto Gemma Router** chooses the right path:

```text
                    ┌──────────────────────┐
                    │   AutoGemmaRouter    │
                    └──────────┬───────────┘
           ONLINE              │              OFFLINE
   OpenRouter free Gemma  ◄────┼────►  Local HF GGUF (llama-server)
   + Google AI Studio          │      managed offline runtime
   free failover               │
                          HYBRID mode
              online first → offline fallback
```

**RAG (Retrieve-Augmented Generation)** runs on extracted document chunks before answering or generating quizzes, so responses stay grounded in uploaded course material.

---

## Why it matters (the classroom reality)

| Challenge | How LetsDoIT responds |
|-----------|------------------------|
| Unstable campus internet | Offline mode via **Hugging Face GGUF** on disk (no Ollama required) |
| Cloud rate limits (HTTP 429) | Primary → backup → tertiary free Gemma + **Google AI Studio** free path |
| Tools scattered across apps | Teacher + student portals in **one desktop app** |
| Materials never reach the AI | PDF extract → **chunk** → store with course → RAG chat & quizzes |
| Dummy “AI” demos | Template quizzes disabled; generation requires a real model |
| Teacher uploads invisible to students | Shared classroom store (disk + localStorage) with live refresh + notice banner |

---

## Feature map

### Teachers
- Create and manage courses with **4-digit join codes**
- Upload lecture material (PDF, notes, related files)
- Automatic **text extraction + chunking** on upload
- **Summarize with Model** — real summary, important points, study help
- Generate **draft quizzes from document chunks** (AI, not templates)
- Review / edit / publish quizzes; view enrollment and weak topics
- Configure Online / Offline / Hybrid AI in **Model** settings

### Students
- Sign in and **join classes with a course code**
- Automatically receive **new and updated materials** for joined courses
- **Document Summary** and **Practice Quiz** from real document chunks
- Choose quiz difficulty: **easy · moderate · hard**
- Attempt quizzes; scores and diagnosis save to the dashboard
- Personalized **AI practice sets** after mistakes (grounded in material)
- Chat with a course-aware tutor using **RAG passages**
- Prefer **English** or **Urdu–English** explanation style

### AI layer
- **Online:** OpenRouter `chat/completions` (free Gemma models) with full raw error reporting, 429 retry, multi-model failover
- **Alternate free online:** Google AI Studio (Gemma / free models) when OpenRouter is rate-limited
- **Offline:** Download or **manually import** Hugging Face GGUF; app runs a local inference engine
- **Hybrid:** online first, then local GGUF
- Connection tests for OpenRouter, Google AI, and offline runtime
- Desktop **Rust HTTP proxy** (no WebView CORS issues)

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Desktop shell | Tauri 2 (Rust) |
| Build | Vite 6 |
| Online AI | OpenRouter free Gemma + Google AI Studio fallback |
| Offline AI | Hugging Face GGUF + managed local `llama-server` |
| Persistence | Shared classroom JSON in app data dir + `localStorage` |
| PDF / RAG | `pdfjs-dist` extraction, chunk index, lexical retrieval (`rag.ts`) |

**Default models**

| Mode | Model / path |
|------|----------------|
| Online primary | `google/gemma-4-26b-a4b-it:free` |
| Online backup | `google/gemma-4-31b-it:free` |
| Online tertiary / failover | Free OpenRouter Gemma chain |
| Google AI Studio default | `gemma-3-27b-it` (and smaller fallbacks) |
| Offline preset | `gemma-2-2b-it-Q4_K_M.gguf` (public GGUF repo) |

---

## Quick start

### End users (Windows)

1. Download the installer from [Releases](https://github.com/Waqar-743/LetsDoIT/releases/latest).
2. Run `LetsDoIT_0.1.0_x64-setup.exe` (or the MSI).
3. Open the app → **Model** tab → add OpenRouter key and/or offline GGUF.
4. Teacher: create course → upload PDF. Student: join with code → Materials.

### Developers

**Prerequisites**

- **Node.js** 20+ and npm  
- **Rust** toolchain (for Tauri desktop builds)  
- Optional: **OpenRouter API key** — [https://openrouter.ai](https://openrouter.ai)  
- Optional: **Google AI Studio key** — [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)  
- Optional: Hugging Face token only for **gated** GGUF models  

**Clone**

```bash
git clone https://github.com/Waqar-743/LetsDoIT.git
cd LetsDoIT
npm install
```

**Web / Vite (browser preview)**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
Offline GGUF download requires the **desktop** build.

**Desktop (dev)**

```bash
npm run desktop:dev
```

**Production desktop build**

```bash
npm run desktop:build
```

Artifacts:

```text
src-tauri/target/release/letsdoit.exe
src-tauri/target/release/bundle/nsis/LetsDoIT_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/LetsDoIT_0.1.0_x64_en-US.msi
```

---

## Configure AI (5 minutes)

### 1. Online — OpenRouter

1. Create a key at [openrouter.ai](https://openrouter.ai) (starts with `sk-or-...`).
2. In the app → **Model** → paste the key.
3. Base URL: `https://openrouter.ai/api/v1`
4. Click **Test Online Model**.

On **HTTP 429** / “Provider returned error”, the app shows the **full raw error**, retries with backoff, then fails over across free Gemma model IDs.

### 2. Free alternate online — Google AI Studio

1. Create a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Paste it under **Google AI Studio** in Model settings.
3. Click **Test Google AI**.

ONLINE / HYBRID will use this path automatically when OpenRouter free capacity is exhausted.

### 3. Offline — Hugging Face GGUF (no Ollama)

1. Open **Model** in the **desktop** app.
2. Paste a GGUF repo link (or pick a preset), e.g.  
   `https://huggingface.co/bartowski/gemma-2-2b-it-GGUF`
3. **Download from Hugging Face**, or if download fails:
   - Download the `.gguf` in a browser
   - **Open models folder** / paste absolute path → **Import into app folder** or **Register path**
4. Click **Test Offline Model**.

### 4. Hybrid

Pick **HYBRID** in the assistant: online when available, local GGUF when not.

---

## Classroom end-to-end flow

```text
Teacher
  → creates course (4-digit code)
  → uploads PDF / notes
  → app extracts text, chunks document, stores with course
  → Summarize with Model (real AI summary + points)
  → optional: generate quiz draft from chunks → publish

Student
  → joins with course code
  → sees materials (live sync + update banner)
  → Document Summary (RAG + model)
  → Practice Quiz (easy / moderate / hard) from real chunks
  → attempts quiz → score saved on dashboard
  → AI practice set from mistakes (not dummy templates)
  → chats with tutor grounded in retrieved passages

Teacher
  → sees enrollment, attempts, weak topics
```

---

## Project structure

```text
LetsDoIT/
├── assets/img/app-icon.svg
├── src/
│   ├── App.tsx                 # Portals, materials, quizzes, model panel
│   ├── components/             # Auth & dashboard UI pieces
│   ├── services/
│   │   ├── ai.ts               # OpenRouter, Google AI, offline, quiz/summary AI
│   │   ├── rag.ts              # Chunk retrieval for grounded answers
│   │   ├── classroomStore.ts   # Shared teacher↔student persistence + sync
│   │   ├── http.ts             # robustFetch (Tauri / Vite proxy)
│   │   ├── localModel.ts       # HF download, import, offline runtime
│   │   ├── desktop.ts          # Tauri invoke helpers
│   │   └── pdf.ts              # PDF/text extraction + chunking
│   └── types.ts
├── src-tauri/
│   ├── src/lib.rs              # Storage, HTTP proxy, HF download, offline engine
│   ├── icons/icon.ico
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite web app on port 3000 |
| `npm run build` | Production frontend → `dist/` |
| `npm run lint` | TypeScript check |
| `npm run desktop:dev` | Tauri + Vite live desktop |
| `npm run desktop:build` | Release desktop installers |
| `npm run clean` | Clear local build artifacts |

---

## Roadmap

- Stronger multi-device / multi-PC cloud sync for lab servers  
- Richer teacher analytics beyond local activity  
- Optional OCR for scanned PDFs  
- Auto-update channel for installers  

This is an active classroom product, not a frozen showcase. Contributions and feedback from real campuses are welcome.

---

## Author & repository

<div align="center">

**Waqar Ahmed**

Built with care for students and teachers who keep showing up — even when the network doesn’t.

[github.com/Waqar-743/LetsDoIT](https://github.com/Waqar-743/LetsDoIT)

</div>

---

## License

Usage terms for this repository are defined by the project owner. If you plan to fork for campus use, open an issue on GitHub so we can align on attribution and deployment.

---

<div align="center">

<img src="assets/img/app-icon.svg" alt="" width="40" height="40" />

**LetsDoIT** — learn when online · keep learning when offline.

</div>
