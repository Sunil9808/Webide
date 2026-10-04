# PROJECT_CONTEXT.md

## 1. Overview
AI Web IDE is a full-featured, browser-based, AI-integrated IDE comparable to VS Code and Cursor, combining Monaco Editor with real LLM assistance.
It provides local workspace editing, terminal sessions via node-pty and WebSocket, live HTML/JS previewing, and an extensible extension runtime.
An autonomous pair-programming agent and chat assistant orchestrate multi-provider LLM models (OpenAI, NVIDIA NIM, Ollama, Gemini) to inspect context, stream responses, and execute file system operations.

## 2. Tech Stack and Versions
### Frontend
- **Framework & Runtime**: React `18.2.0`, React DOM `18.2.0`, TypeScript `5.3.2`
- **Code Editor**: Monaco Editor `0.44.0`, `@monaco-editor/react` `4.6.0`, `emmet-monaco-es` `5.7.0`
- **State Management**: Zustand `4.4.0`
- **Routing**: React Router DOM `7.18.2`
- **Styling & Animation**: Tailwind CSS `3.3.6`, PostCSS `8.4.32`, Autoprefixer `10.4.16`, Framer Motion `10.16.0`, Lucide React `0.294.0`
- **Markdown & Code Display**: `react-markdown` `10.1.0`, `react-syntax-highlighter` `16.1.1`, `diff` `9.0.0`
- **Terminal Client**: Xterm.js `5.3.0` (`xterm-addon-fit` `0.8.0`, `xterm-addon-search` `0.13.0`, `xterm-addon-web-links` `0.9.0`)
- **Networking**: `socket.io-client` `4.6.0`, `axios` `1.6.0`

### Backend
- **Runtime & Language**: Node.js with TypeScript `5.3.2`, `ts-node-dev` `2.0.0`
- **Server Framework**: Express `4.18.2` (in `server/package.json`), Express `5.2.1` (in root manifest)
- **Terminal & Process Engine**: `node-pty` `1.1.0`, Socket.IO `4.6.0`
- **Logging & Utilities**: Winston `3.11.0`, `dotenv` `16.3.1`, `cors` `2.8.5`, `uuid` `9.0.0`

### AI Providers & SDKs
- **OpenAI & NVIDIA NIM**: `openai` `4.20.0` (handles OpenAI and OpenAI-compatible NVIDIA NIM endpoints via `OPENAI_BASE_URL: https://integrate.api.nvidia.com/v1`)
- **Google Gemini**: `@google/generative-ai` `0.24.1` (supports `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`)
- **Ollama (Local)**: Native HTTP fetch against `OLLAMA_BASE_URL` (default: `http://127.0.0.1:11434`)
- **Anthropic Claude**: `@anthropic-ai/sdk` `0.32.0` (adapter present in registry, conditionally loaded if `ANTHROPIC_API_KEY` exists; planned feature, do not touch)

### Build Tools & Scripts
- **Bundler**: Vite `7.3.6`, `@vitejs/plugin-react` `4.2.0`
- **Process Orchestration**: Concurrently `8.2.2`

## 3. Folder Map
- `dist-check/`: Build verification output containing compiled preview assets and `index.html`.
- `login-app/`: Example project / test fixture folder containing `data.json`.
- `node_modules/`: Root dependencies installed by npm.
- `server/`: Backend Express application and WebSocket infrastructure.
  - `controllers/`: Route request handlers (`aiController.ts`, `fileController.ts`).
  - `middleware/`: HTTP pipeline middleware (`errorHandler.ts`, `requestLogger.ts`).
  - `routes/`: Express endpoint routing (`aiRoutes.ts`, `fileRoutes.ts`, `projectRoutes.ts`, `sessionRoutes.ts`, `terminalRoutes.ts`, `workspaceRoutes.ts`).
  - `services/`: Core backend domain logic:
    - `services/ai/`: Agent loop execution (`agentService.ts`), AI service facade (`aiService.ts`), local NLU intent engine (`nluService.ts`), provider adapter registry (`adapterRegistry.ts`), and adapters (`adapters/openaiAdapter.ts`, `adapters/geminiAdapter.ts`, `adapters/ollamaAdapter.ts`, `adapters/anthropicAdapter.ts`).
    - `services/fileSystem/`: Disk operations (`fileSystemService.ts`).
    - `services/sessionService.ts`: Session storage management.
  - `socket/`: Real-time WebSocket hubs (`socketServer.ts`, `terminalSocket.ts`).
  - `storage/`: Persisted sessions and workspace storage roots.
  - `terminal/`: PTY terminal lifecycle management (`terminalManager.ts`).
  - `utils/`: Workspace root detection and filesystem watch helpers (`workspaceRoot.ts`, `workspaceWatcher.ts`).
- `src/`: Frontend React application.
  - `components/`: Modular UI panels (`ActivityBar/`, `BottomPanel/`, `Editor/`, `MenuBar/`, `Sidebar/`, `StatusBar/`, `TitleBar/`).
    - `components/Sidebar/AIChat/`: AI panels, chat view, agent panel, model selector, slash command & mention menus.
  - `hooks/`: Custom state and lifecycle hooks (`useAIChat.ts`, `useEditor.ts`, `useResizable.ts`, `useTerminal.ts`, `useTheme.ts`).
  - `layouts/`: IDE frame and docking layout (`WorkspaceLayout.tsx`).
  - `routes/`: Frontend routing (`AppRoutes.tsx`).
  - `services/`: Frontend client service layer (`aiService.ts`, `inlineCompletionService.ts`, `fileService.ts`, `terminalService.ts`, `extension*`, `themeService.ts`, `workspaceService.ts`).
  - `setup/`: Monaco editor worker registration and language defaults (`monacoSetup.ts`).
  - `store/`: Zustand state management stores (`aiStore.ts`, `editorStore.ts`, `fileStore.ts`, `extensionStore.ts`, `settingsStore.ts`, `sourceControlStore.ts`, `terminalStore.ts`, `thunderStore.ts`, `uiStore.ts`, `workspaceStore.ts`).
  - `styles/`: Application styles and CSS theme variables (`globals.css`).
  - `types/`: Domain TypeScript type contracts (`ai.types.ts`, `editor.types.ts`, `file.types.ts`, `terminal.types.ts`, etc.).
  - `utils/`: Frontend helper utilities (`chatCommands.ts`, `constants.ts`, `fileHelpers.ts`, `materialFileIcons.ts`, `nluClient.ts`, `uuid.ts`).

## 4. Architecture
### End-to-End Chat Flow
1. **User Input**: The user inputs a message in `AIChatInputBar.tsx` within `ChatView.tsx` (Chat mode) or `AgentPanel.tsx` (Cowork mode).
2. **Context Assembly**: `useAIChat.ts` builds request context (`currentFile`, `workspaceName`, `workspacePath`).
3. **Store Dispatch**: The user prompt and an empty streaming assistant message placeholder are added to `aiStore.ts`.
4. **API Request**: The client sends a POST request to `/api/ai/chat` (or `/api/ai/agent/stream` for agent tasks) with `{ prompt, context, model, provider, profile, sessionId, conversationHistory }`.
5. **NLU Preprocessing**: In `server/controllers/aiController.ts`, `processNLU` in `server/services/ai/nluService.ts` cleans the prompt, corrects typos, infers intent, and checks for destructive operations. The NLU outcome is attached to `context.nluResult`.
6. **AI Service Facade**: `aiController` passes the request to `streamChatResponse` in `server/services/ai/aiService.ts`. System instructions are generated via `buildSystemPrompt` combining workspace context, active file content, and intent analysis.
7. **Adapter Invocation**: The adapter is obtained via `adapterRegistry.getAdapter(provider)`. In `aiService.ts`, `streamChatResponse` honors the frontend-supplied `options.provider` and falls back to `getAIProvider()` (`process.env.AI_PROVIDER`) only when omitted.
8. **Model Provider Communication**: The resolved adapter (`OpenAIAdapter`, `GeminiAdapter`, or `OllamaAdapter`) calls the external LLM API via streaming (OpenAI Chat Completions SSE, Gemini `generateContentStream`, or Ollama `/api/chat` stream).
9. **SSE Server Streaming**: Tokens are streamed back to Express response as Server-Sent Events (`data: {"choices":[{"delta":{"content":"..."}}]}`).
10. **Client Consumption**: `useAIChat.ts` consumes the stream via `TextDecoder` and `ReadableStreamDefaultReader`, updating `aiStore.appendToLastMessage` on each chunk. Monaco and React components re-render in real time until `[DONE]` or stream finalization.

### Provider and Model Switching Mechanism
1. **Model Discovery**: On mount, `ModelSelector.tsx` invokes `fetchModels()` on `aiStore.ts`, which hits `GET /api/ai/models`.
2. **Dynamic Aggregation**: `server/controllers/aiController.ts` delegates to `adapterRegistry.getAllModels()`, which invokes `getModels()` across all registered adapters concurrently and deduplicates results.
3. **UI Selection**: Selecting a model in `ModelSelector.tsx` updates `selectedModel` in `aiStore.ts`.
4. **Transmission**: `useAIChat.ts` looks up the selected model in `availableModels`, extracting both `model` ID and `provider` ID, and sends them in the request body to `/api/ai/chat`.
5. **Backend Dispatch**: `aiService.ts` respects the requested provider (`options.provider`), routing models like `deepseek-ai/deepseek-v4.1-flash` to `OpenAIAdapter`. In `openaiAdapter.ts`, `getClient()` dynamically detects NVIDIA NIM models and looks for `NVIDIA_API_KEY` (or `OPENAI_API_KEY`) pointing to `https://integrate.api.nvidia.com/v1`, reporting clear provider-specific errors if unconfigured.

## 5. Module Ownership Table
| Module | Key Files | Owner |
|---|---|---|
| **Agent Chat Loop** | `src/components/Sidebar/AIChat/AIChatPanel.tsx`<br>`src/components/Sidebar/AIChat/ChatView.tsx`<br>`src/components/Sidebar/AIChat/AgentPanel.tsx`<br>`src/components/Sidebar/AIChat/AIChatInputBar.tsx`<br>`src/hooks/useAIChat.ts`<br>`src/services/aiService.ts`<br>`src/store/aiStore.ts`<br>`server/controllers/aiController.ts`<br>`server/services/ai/agentService.ts`<br>`server/services/ai/nluService.ts` | Senior Full-Stack Engineer (Me) |
| **Model Switching** | `src/components/Sidebar/AIChat/ModelSelector.tsx`<br>`server/services/ai/adapterRegistry.ts`<br>`server/services/ai/adapters/types.ts` | Senior Full-Stack Engineer (Me) |
| **Ollama / NVIDIA NIM Backend** | `server/services/ai/adapters/ollamaAdapter.ts`<br>`server/services/ai/adapters/openaiAdapter.ts` | Senior Full-Stack Engineer (Me) |
| **Inline Autocomplete** | `src/services/inlineCompletionService.ts`<br>`src/setup/monacoSetup.ts`<br>`src/components/Editor/MonacoEditor.tsx` | Senior Full-Stack Engineer (Me) |
| **Terminal Subsystem** | `src/components/Terminal/*`<br>`src/services/terminalService.ts`<br>`src/store/terminalStore.ts`<br>`server/terminal/*`<br>`server/socket/terminalSocket.ts`<br>`server/routes/terminalRoutes.ts` | Teammate A |
| **Extensions & LSP** | `src/components/Sidebar/Extensions/*`<br>`src/services/extension*`<br>`src/store/extensionStore.ts` | Teammate B |
| **Git Backend & Debug Panel** | `src/components/Sidebar/SourceControl/*`<br>`src/store/sourceControlStore.ts`<br>`src/components/Sidebar/RunAndDebug/*` | Teammate C |
| **Shared Core & Workspace** | `src/layouts/*`<br>`src/store/fileStore.ts`<br>`src/store/workspaceStore.ts`<br>`src/services/fileService.ts`<br>`server/controllers/fileController.ts`<br>`server/utils/workspaceRoot.ts` | Shared / Foundational |

## 6. Conventions
- **Naming Conventions**:
  - React components: PascalCase (e.g., `AIChatPanel.tsx`, `MonacoEditor.tsx`).
  - React hooks: camelCase with `use` prefix (e.g., `useAIChat.ts`, `useEditor.ts`).
  - Stores: camelCase with `use` prefix and `Store` suffix (e.g., `useAIStore`, `useFileStore`).
  - Services / Utilities: camelCase (e.g., `aiService.ts`, `inlineCompletionService.ts`, `chatCommands.ts`).
  - Backend controllers & routes: camelCase (e.g., `aiController.ts`, `aiRoutes.ts`).
- **State Management**:
  - Zustand stores centralized under `src/store/`.
  - Atomic selector subscriptions in components to prevent unnecessary re-renders.
  - Ephemeral view/input states are encapsulated in local React `useState`.
- **API Patterns**:
  - Base REST route prefix `/api/*`.
  - Long-running AI responses use Server-Sent Events (SSE) with `Content-Type: text/event-stream`.
  - Terminal stream I/O uses Socket.IO over `/socket.io`.
  - Static workspace previews served over `/preview`.
- **Error Handling**:
  - Backend: Centralized Express `errorHandler.ts` middleware (`next(error)`).
  - Streaming Errors: Flushed via SSE event payload before stream closure (`data: {"error": "..."}`).
  - Frontend: Global store error capturing (`setError`) paired with user-facing notification toasts and inline retry buttons (`useAIChat.ts`).

## 7. Known Issues
- **Models ignore project context** [partially resolved / verified]:
  - *References*: `server/services/ai/aiService.ts:41-44`, `server/services/ai/aiService.ts:80`, `server/services/ai/aiService.ts:95-98`, `src/hooks/useAIChat.ts:21-34`
  - *Details*: `buildContext` in `useAIChat.ts` does not include open files or file tree context in standard chat requests. Furthermore, `aiService.ts:41-44` and `aiService.ts:80` contain explicit prompt directives instructing models to answer general programming questions generally and NOT force answers into active files. (Note: The provider override bug in `aiService.ts:97` that forced all requests to `process.env.AI_PROVIDER` has been resolved; `options.provider` is now honored with fallback to `getAIProvider()`).
- **Wrong code for simple algorithm requests** [verified]:
  - *References*: `server/services/ai/nluService.ts:292-300`, `server/services/ai/aiService.ts:43`, `server/services/ai/agentService.ts:1028-1031`
  - *Details*: Models frequently generate non-machine-learning code (such as linear search or decision trees) or incorrect languages for simple algorithm requests. Hardcoded regex overrides and prompt patches were added specifically for Find-S, PCA, SVM, and KNN to force Python and Tom Mitchell's algorithm.
- **"/" and "@" triggers in chat not working** [verified]:
  - *References*: `src/components/Sidebar/AIChat/AIChatInputBar.tsx:59-83`, `src/components/Sidebar/AIChat/AIChatInputBar.tsx:116-160`, `src/utils/chatCommands.ts:14-20`, `server/services/ai/agentService.ts:949-953`
  - *Details*: The slash trigger regex (`/(\w*)$`) only triggers at the start of input and fails when arguments or spaces are appended. For `@` mentions, `chatCommands.ts` inserts generic tokens (`@file`, `@workspace`) that frontend `aiService.ts` does not parse. When sent to the agent backend, `agentService.ts:952` treats `@file` as a literal file name `file`, failing with `"❌ <path> not found"`.
- **Models won't create project folder structures** [verified]:
  - *References*: `server/services/ai/agentService.ts:412-414`, `server/services/ai/agentService.ts:935-937`, `server/services/ai/agentService.ts:1044`, `server/services/ai/agentService.ts:1369-1383`, `src/components/Sidebar/AIChat/AgentPanel.tsx:274-320`
  - *Details*: `shouldUseNewProjectScaffold` is hardcoded to return `false` (line 413). Prompt rules instruct the model to produce max 3 files per turn and put the rest into `remainingFiles` (line 1044), but `AgentPanel.tsx` has no handler to fetch or process `remainingFiles`. Additionally, the stream cut-off recovery parser (line 1369) only salvages `writeFile` actions and discards `mkdir` directory actions.
- **Agent/cowork mode only works when a folder is open** [verified]:
  - *References*: `src/components/Sidebar/AIChat/AgentPanel.tsx:266`, `src/components/Sidebar/AIChat/AgentPanel.tsx:713-716`
  - *Details*: In `AgentPanel.tsx:266`, `handleApply` executes an early return: `if (!planData || !planData.actions || workspace?.type !== 'local') return;`. If no local folder is open (or a virtual workspace is active), file creation actions silently do nothing, contradicting the banner at lines 713-716 stating changes will apply to the virtual workspace.

## 8. Do-Not-Touch List
- **Terminal Subsystem**: `src/components/Terminal/*`, `src/services/terminalService.ts`, `src/store/terminalStore.ts`, `server/terminal/*`, `server/socket/terminalSocket.ts`, `server/routes/terminalRoutes.ts`.
- **Extensions & LSP Subsystem**: `src/components/Sidebar/Extensions/*`, `src/services/extension*`, `src/store/extensionStore.ts`.
- **Git Backend & Debug Panels**: `src/components/Sidebar/SourceControl/*`, `src/store/sourceControlStore.ts`, `src/components/Sidebar/RunAndDebug/*`.
- **Anthropic / Claude Integration**: `server/services/ai/adapters/anthropicAdapter.ts` (adapter must NOT be activated or expanded unless explicitly requested).
- **Legacy Artifacts**: `old-titlebar.tsx`, `old-titlebar-utf8.tsx`, `native-picker.js`, `install-registry.bat`.

## 9. Feature Log
| Date | Feature | Files changed | Notes |
|---|---|---|---|
| 2026-10-04 | Fix deepseek model provider routing & NIM key error | server/services/ai/aiService.ts, server/services/ai/adapters/openaiAdapter.ts, server/controllers/aiController.ts, .env.example | Honored frontend options.provider in streamChatResponse with getAIProvider() fallback; added NVIDIA NIM apiKey/baseURL detection and provider-specific missing key errors. |
