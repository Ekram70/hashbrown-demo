# Hashbrown GenUI Monorepo 🥔✨

A cutting-edge monorepo showcasing **Generative User Interfaces (GenUI)**, built with the modern **Angular** frontend framework and a **Node.js/Express** proxy backend.

This project integrates the **[Hashbrown Framework](https://hashbrown.dev)** to enable real-time streaming of reactive AI components and LLM completions.

---

## 🏗️ Repository Architecture

This repository is structured as a native **npm workspace**:

```
hashbrown/ (Monorepo Root)
├── package.json (npm workspaces, central scripts)
├── .gitignore (exclusion configuration)
└── apps/
    ├── backend/ (Express + TypeScript + tsx execution)
    │   ├── src/
    │   │   └── index.ts (streaming completion endpoint)
    │   ├── tsconfig.json
    │   └── package.json
    └── frontend/ (Angular Standalone SPA)
        ├── proxy.conf.json (port-forwarding configuration)
        ├── angular.json (dev-server configurations)
        ├── package.json
        └── src/
            ├── app/
            │   ├── app.config.ts (Hashbrown provider setup)
            │   ├── app.ts (Signals & widget streaming parser)
            │   └── app.html (responsive chat interface)
            └── styles.css (premium design system stylesheet)
```

---

## ⚡ Quick Start (Local Development)

Manage the entire stack from the root directory with single, simple commands:

### 1. Install all dependencies
```bash
npm install
```

### 2. Launch Frontend & Backend Concurrently
```bash
npm run dev
```
* **Express Backend:** listening at [http://localhost:3000](http://localhost:3000)
* **Angular Frontend:** listening at [http://localhost:4200](http://localhost:4200)

### 3. Build for Production
```bash
npm run build
```

---

## 🤖 LLM & Simulation Modes

The Express backend supports real-time completion streaming using **Google Gemini** or **OpenAI**:
- To connect a live LLM, configure your environment variables:
  ```bash
  # Create a .env file in /apps/backend/
  GEMINI_API_KEY=your_gemini_api_key_here
  # OR
  OPENAI_API_KEY=your_openai_api_key_here
  ```
- **Intelligent Offline Simulation:** If no API keys are present, the backend automatically falls back to an **interactive simulation mode**. It streams realistic typewriter-effect tokens and complex JSON payload widgets to allow full interface testing out-of-the-box!

---

## 🔮 Generative UI Features

Try typing the following messages in the chat workspace to test custom GenUI rendering:
- **"recipe"** - Streams an **Interactive Recipe Checklist Widget**. Tick off ingredients and see them cross out with smooth transitions in real-time.
- **"status"** or **"dashboard"** - Streams a **Real-Time Backend Monitor Widget** containing uptime clocks, network request counts, latency metrics, and resource utilization bars.
