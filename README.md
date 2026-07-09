<div align="center">

<img src="assets/img/app-icon.svg" alt="LetsDoIT" width="140" height="140" />

<br />

**Hybrid Offline / Online Classroom AI — built for real classrooms, not demo slides.**

</div>

---

## The story behind the name

**LetsDoIT** started from a simple frustration shared across many Pakistani colleges and universities:

> Wi‑Fi drops mid-lecture. Load-shedding kills the router. Cloud-only AI demos look great in pitch decks — and fail the moment students need them most.

So the product goal became personal and practical:

- **Teachers** should upload notes, issue quizzes, and see who’s enrolled — without fighting five separate tools.
- **Students** should join a course with a short code, open materials, and ask an AI tutor that still works **offline**.
- **AI** should be real Gemma inference — not scripted placeholder text — with a clear path between **Online (OpenRouter)** and **Offline (Ollama)**.

The name is a promise: stop waiting for perfect connectivity. **Let’s do it** with a hybrid classroom assistant that respects the network you actually have.

---

## What LetsDoIT is

LetsDoIT is an **offline-first hybrid AI classroom app** with two portals under one roof:

| Portal | Who it’s for | What they can do |
|--------|----------------|------------------|
| **Teacher** | Instructors & lab staff | Create courses, share 4‑digit join codes, upload materials (PDF & more), generate quizzes, monitor activity |
| **Student** | Learners | Join courses, browse materials, chat with Gemma, practice quizzes, track preparation |

Under the hood, a single **Auto Gemma Router** chooses the right path:

```text
                ┌─────────────────────┐
                │   AutoGemmaRouter   │
                └──────────┬──────────┘
           ONLINE          │          OFFLINE
    OpenRouter Gemma  ◄────┼────►  Local Ollama Gemma
  (free / hosted models)   │     (localhost:11434)
                           │
                      HYBRID mode
              online first → offline fallback
```

---

## Why it matters (the classroom reality)

<div align="center">

| Challenge | How LetsDoIT responds |
|-----------|------------------------|
| Unstable campus internet | Offline mode via **Ollama + local Gemma** |
| Cloud cost & API lock-in | Free OpenRouter Gemma models + local fallback |
| Tools scattered across apps | Teacher + student portals in **one desktop app** |
| Materials never reach the AI | PDF text extraction → course-aware chat & quizzes |
| “AI demo” that can’t be tested | Built-in **Test Online / Test Offline** connection checks |

</div>

---

## Feature map

### For teachers
- Create and manage courses with **4-digit join codes**
- Upload lecture material (PDF and related classroom files)
- Generate and manage quizzes from course content
- View enrolled students and basic learning activity
- Configure online / offline AI in the Model settings panel

### For students
- Sign in and **join classes with a course code**
- Browse syllabus materials and open them for study
- Chat with a **Gemma teaching assistant** (course-aware)
- Attempt quizzes & practice sets; review mistakes with AI help
- Prefer **English** or **Urdu–English** explanation style

### For the AI layer
- **Online:** OpenRouter `chat/completions` with Gemma (primary + backup model IDs)
- **Offline:** Ollama local chat API (`http://localhost:11434`)
- **Hybrid:** try online first, fall back to local when the cloud fails
- Connection tests, model download (Ollama pull), and desktop-side HTTP proxy so the WebView never dies on CORS

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Desktop shell | Tauri 2 (Rust) |
| Build | Vite 6 |
| Online AI | OpenRouter → Gemma free models |
| Offline AI | Ollama → local Gemma models |
| Persistence | Desktop app data dir (JSON) + browser `localStorage` fallback |
| PDF text | `pdfjs-dist` client extraction |

**Default models**

| Mode | Model |
|------|--------|
| Online primary | `google/gemma-4-26b-a4b-it:free` |
| Online backup | `google/gemma-4-31b-it:free` |
| Offline default | `gemma2:2b` (pull more from Model settings) |

---

## Quick start

### Prerequisites

- **Node.js** 20+ and npm  
- **Rust** toolchain (for Tauri desktop builds)  
- Optional: **Ollama** for offline Gemma — [https://ollama.com](https://ollama.com)  
- Optional: **OpenRouter API key** for online Gemma — [https://openrouter.ai](https://openrouter.ai)

### Clone

```bash
git clone https://github.com/Waqar-743/LetsDoIT.git
cd LetsDoIT
npm install
```

### Run (web / Vite)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run (desktop)

```bash
npm run desktop:dev
```

### Production desktop build

```bash
npm run desktop:build
```

Artifacts land under:

```text
src-tauri/target/release/letsdoit.exe
src-tauri/target/release/bundle/nsis/LetsDoIT_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/LetsDoIT_0.1.0_x64_en-US.msi
```

---

## Configure AI (5 minutes)

### 1. Online — OpenRouter

1. Create a key at [openrouter.ai](https://openrouter.ai) (starts with `sk-or-...`).
2. In the app → **Model** settings → paste the key.
3. Confirm base URL: `https://openrouter.ai/api/v1`
4. Click **Test Online Model**.

Desktop builds call OpenRouter through a **Rust HTTP proxy** (no WebView CORS drama). Browser dev uses a Vite proxy (`/__proxy/openrouter`).

### 2. Offline — Ollama

1. Install and start [Ollama](https://ollama.com) (system tray on Windows).
2. Endpoint: `http://localhost:11434`
3. In Model settings → download a Gemma model (e.g. `gemma2:2b`).
4. Click **Test Offline Model**.

### 3. Hybrid

Pick **HYBRID** in the assistant mode control: online when available, local when not.

---

## Project structure

```text
LetsDoIT/
├── assets/img/app-icon.svg     # Brand icon used in this README
├── src/
│   ├── App.tsx                 # App shell, portals, model panel
│   ├── components/             # Auth, student & teacher dashboards
│   ├── services/
│   │   ├── ai.ts               # OpenRouter + Ollama + Auto router
│   │   ├── http.ts             # robustFetch (Tauri proxy / Vite proxy)
│   │   ├── desktop.ts          # Tauri invoke helpers
│   │   └── pdf.ts              # Material text extraction
│   └── types.ts
├── src-tauri/
│   ├── src/lib.rs              # Desktop storage + HTTP proxy commands
│   ├── icons/icon.ico
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

---

## End-to-end classroom flow

```text
Teacher logs in
    → creates a course (4-digit code)
    → uploads PDF / notes
    → (optional) generates quiz with Gemma

Student logs in
    → enters course code → course appears
    → opens materials
    → chats with Gemma (online / offline / hybrid)
    → practices quizzes · reviews mistakes

Teacher
    → sees enrollment & activity
```

That loop is the product. Everything else is scaffolding around it.

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

## Roadmap (honest)

- Stronger multi-device sync / shared backend when labs need a server  
- Richer analytics for teachers beyond local activity  
- More offline model providers (llama.cpp / mistral.rs paths)  
- Polished packaging icons & auto-update channel  

This is an active classroom product, not a frozen showcase. Contributions and harsh feedback from real campuses are welcome.

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
