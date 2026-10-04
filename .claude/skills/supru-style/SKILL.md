---
name: supru-style
description: Build "Supru" - a dark, floating-pill AI coding platform delivered as an installable desktop app for Windows, macOS and Linux (Electron). Includes the exact Supru visual style (draggable/resizable pill input with "+" attachments and a "Meow!" send button), a left file explorer, a right-side Chat and real-terminal CLI window, connections to cloud models (build.nvidia.com, Anthropic, OpenAI-compatible), local models (Ollama, LM Studio), Claude Code CLI, and GitHub Copilot, and a JSON-driven multi-agent orchestration engine that runs end-to-end projects from commands, skill.md, README.md and ROADMAP.md. Use this skill whenever the user asks for a Supru app, a Supru-style UI, an installed AI coding app or workbench, a floating AI bar, a multi-agent pipeline configured by JSON, or anything "same style as Supru", even if they only mention part of it.
---

# Supru

Supru is an installable desktop app (Electron) for coding with AI, with a floating pill as its command input. It is not a web page: it runs on the user's laptop with full access to the project folder, real terminals, and the user's installed CLIs. Behind the pill sits a workbench: file explorer on the left, editor in the middle, Chat and CLI windows on the right. Models and CLIs are plugged in through a connections registry, and a JSON file defines an autonomous agent team that can run an end-to-end project pipeline. The UI is written in HTML/CSS/JS inside the app's window (the `renderer`); everything that touches the computer lives in the app's Node.js `main` process.

Keep every visual value in this file exactly as written. Change content (labels, models, endpoints, agents), never the style.

## 0. Desktop architecture (read first)

Supru is an **Electron** app. Electron is the right fit because the UI is web tech (so the pill style ports exactly) while the Node.js side can do what a web page cannot: read/write any project folder, spawn real terminals and CLIs (Claude Code, Copilot), call any API without CORS limits, and store secrets in the OS keychain. (Tauri is a lighter alternative, but it needs Rust and a separate PTY solution; choose it only if the user asks.)

Three layers, strictly separated:

| Layer | File | Job |
|---|---|---|
| **main** (Node.js) | `src/main/main.js` + `src/main/*.js` | creates the window; owns the file system, shell/PTY, git, provider HTTP calls, key storage, the permission gate, and the orchestrator |
| **preload** | `src/preload/preload.js` | the only bridge to the UI: exposes a small, named API through `contextBridge.exposeInMainWorld("supru", {...})` |
| **renderer** (UI) | `src/renderer/index.html`, `renderer.css`, `renderer.js` | the pill, explorer, editor, Chat/CLI/Agents tabs; contains no secrets and no direct disk or network access |

Security settings are mandatory: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true` for the renderer, a strict Content-Security-Policy meta tag (`default-src 'self'; style-src 'self' 'unsafe-inline'`), no `remote` module, `webSecurity` left on, navigation and `window.open` blocked. The renderer asks, main decides: every IPC call is validated and passes through the permission gate (section 10.4). Agents and the UI never get raw Node access.

Because everything runs in the main process there is no separate server, no CORS, and no token handshake. Keys never reach the renderer except as masked placeholders.

**Prerequisites to tell the user**: Node.js LTS and npm, Git; to compile the terminal module (`node-pty`) on Windows install "Desktop development with C++" build tools and Python, on macOS Xcode command line tools, on Linux `build-essential` and Python (or use a prebuilt fork of node-pty to avoid compiling). After `npm install`, run `npx electron-rebuild` so native modules match Electron's Node version.

## 1. Design tokens

| Token | Value | Used for |
|---|---|---|
| page background | `#0a0a0c` | `body` |
| pill background | `#2b2b2d` | `#app` (the pill) |
| pill border | `#3c3c3e` | `#app` |
| panel background | `#161618` | thread, popovers, explorer, side panel |
| panel border | `#2a2a2c` / `#2c2c30` | panels / popovers |
| field/option background | `#0e0e11` | inputs, `.opt`, `.sw`, chips |
| field border | `#2d2d33` inputs, `#26262a` options | |
| accent (warm tan) | `#c49a6c` | focus, hover, selected, active tab |
| user text | `#9ecbff` | `.u` |
| bot text | `#e4e4e7` | `.b` |
| muted text | `#8a8a8a` | `.t`, placeholder |
| label grey | `#777` | labels, tags |
| hint grey | `#666` | `.hint` |
| ok / terminal green | `#4af626` | `.hint.on`, code, terminal text |
| error | `#ff6b6b` | `.e`, `.hint.bad` |
| inline code | bg `#1d1d20`, text `#ffd580` | `code` |
| code/terminal block | bg `#050505`, border `#2a2a2a` | `.c`, terminal, editor |
| send button | bg `#f2f2f2`, text `#151515` | `#send` |
| font | `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif` | everything |
| mono font | `ui-monospace,SFMono-Regular,Consolas,monospace` | code, editor, terminal |

Radii: pill `999px`, panels `14px`, options/inputs/code `8px`, inline code `4px`, chips `999px`. Shadows: `0 16px 44px rgba(0,0,0,.55)` on the pill, `0 14px 40px rgba(0,0,0,.5)` on panels. No new colors, no light theme, no external fonts or icon libraries (inline SVG only, stroke `currentColor`, round caps and joins).

## 2. CSS

### 2a. Pill core (use verbatim)

```css
*{box-sizing:border-box}
body{margin:0;height:100vh;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}
#app{position:fixed;width:33vw;min-width:300px;max-width:94vw;min-height:56px;background:#2b2b2d;border:1px solid #3c3c3e;border-radius:999px;box-shadow:0 16px 44px rgba(0,0,0,.55);display:flex;align-items:center;gap:8px;padding:10px 12px;z-index:50}
#app.drop{border-color:#c49a6c}
#plus{flex:0 0 auto;width:26px;height:26px;border:0;background:transparent;color:#fff;font-size:24px;font-weight:300;line-height:1;cursor:pointer}
#in{flex:1 1 auto;min-width:40px;background:transparent;border:0;outline:0;color:#fff;font-size:15px;line-height:1.35;font-family:inherit;resize:none;height:20px;max-height:88px;overflow:auto;padding:0}
#in::placeholder{color:#8a8a8a}
#model{flex:0 0 auto;display:flex;align-items:center;gap:5px;background:transparent;border:0;color:#cfcfcf;font-size:14px;font-family:inherit;cursor:pointer;padding:4px;white-space:nowrap}
#model svg{transition:transform .15s}
#model.open svg{transform:rotate(180deg)}
#send{flex:0 0 auto;height:40px;padding:0 16px;border-radius:999px;border:0;background:#f2f2f2;color:#151515;font-size:14px;font-weight:600;font-family:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer}
#send:disabled{opacity:.55;cursor:default}
#send .dots span{display:inline-block;width:4px;height:4px;margin:0 1px;border-radius:50%;background:#151515;animation:bl 1s infinite}
#send .dots span:nth-child(2){animation-delay:.15s}#send .dots span:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,80%,100%{opacity:.25}40%{opacity:1}}
#thread{position:absolute;left:0;right:0;bottom:calc(100% + 10px);max-height:60vh;overflow:auto;background:#161618;border:1px solid #2a2a2c;border-radius:14px;padding:10px 12px;display:none;flex-direction:column;gap:6px;font-size:13px;line-height:1.45;color:#e4e4e7;box-shadow:0 14px 40px rgba(0,0,0,.5);z-index:9}
#thread.on{display:flex}
#clr{position:absolute;top:6px;right:8px;border:0;background:transparent;color:#777;font-size:14px;cursor:pointer}
#clr:hover{color:#fff}
.u{color:#9ecbff}.b{color:#e4e4e7}.t{color:#8a8a8a}.e{color:#ff6b6b}
.m{display:block;font-size:9px;color:#777;text-transform:uppercase;margin:4px 0 2px}
.c{background:#050505;border:1px solid #2a2a2a;border-radius:8px;padding:8px;overflow:auto;color:#4af626;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}
code{background:#1d1d20;color:#ffd580;padding:1px 4px;border-radius:4px;font-size:11px}
.pop{position:absolute;left:0;right:0;bottom:calc(100% + 10px);background:#161618;border:1px solid #2c2c30;border-radius:14px;padding:10px;display:none;flex-direction:column;gap:7px;box-shadow:0 14px 40px rgba(0,0,0,.5);z-index:20}
.pop.on{display:flex}
.pop label{font-size:9px;color:#777;text-transform:uppercase}
.pop input,.pop select{width:100%;background:#0e0e11;border:1px solid #2d2d33;color:#fff;border-radius:8px;padding:7px;font-size:12px;font-family:inherit;outline:0}
.pop input:focus,.pop select:focus{border-color:#c49a6c}
.pop .hint,.hint{font-size:10px;color:#666}
.hint.on{color:#4af626}.hint.bad{color:#ff6b6b}
.opt,.sw{display:flex;align-items:center;justify-content:space-between;background:#0e0e11;border:1px solid #26262a;border-radius:8px;padding:7px 9px;color:#ddd;font-size:12px;font-family:inherit;cursor:pointer}
.opt:hover,.sw:hover{border-color:#c49a6c}
.opt.sel{border-color:#c49a6c;color:#c49a6c}
.tag{font-size:9px;color:#777}
.rz{position:absolute;z-index:100}
.rz.n{top:0;left:20px;right:20px;height:10px;cursor:ns-resize}
.rz.s{bottom:0;left:20px;right:20px;height:10px;cursor:ns-resize}
.rz.w{left:0;top:20px;bottom:20px;width:10px;cursor:ew-resize}
.rz.e{right:0;top:20px;bottom:20px;width:10px;cursor:ew-resize}
.rz.nw{top:0;left:0;width:20px;height:20px;cursor:nwse-resize}
.rz.ne{top:0;right:0;width:20px;height:20px;cursor:nesw-resize}
.rz.sw{bottom:0;left:0;width:20px;height:20px;cursor:nesw-resize}
.rz.se{bottom:0;right:0;width:20px;height:20px;cursor:nwse-resize}
```

Differences from the original Supru bar: `#send` is now a pill-shaped button whose label is the text `Meow!` (no arrow icon), and `z-index` of `#app` is 50 so it floats above the workbench.

### 2b. Workbench additions (same tokens, no new colors)

```css
#wb{position:fixed;inset:0;display:grid;grid-template-columns:240px 1fr 380px;gap:10px;padding:10px;z-index:1}
.pane{background:#161618;border:1px solid #2a2a2c;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ph{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #2a2a2c;font-size:9px;color:#777;text-transform:uppercase}
.ph .sp{flex:1}
.ib{border:0;background:transparent;color:#777;font-size:14px;cursor:pointer;padding:2px 4px}.ib:hover{color:#fff}
.tabs{display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #2a2a2c}
.tab{background:#0e0e11;border:1px solid #26262a;border-radius:999px;padding:4px 12px;font-size:12px;color:#ddd;cursor:pointer;font-family:inherit}
.tab.sel{border-color:#c49a6c;color:#c49a6c}
#tree{flex:1;overflow:auto;padding:6px;font-size:12px;color:#ddd}
.tn{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;cursor:pointer;white-space:nowrap}
.tn:hover{background:#0e0e11}.tn.sel{background:#0e0e11;color:#c49a6c}
.tn .tg{margin-left:auto;font-size:9px;color:#777}
#edtabs{display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #2a2a2c;overflow:auto}
#ed{flex:1;width:100%;background:#050505;border:0;outline:0;color:#e4e4e7;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;padding:10px;resize:none;tab-size:2;white-space:pre}
#term{flex:1;background:#050505;color:#4af626;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;padding:8px;overflow:auto;white-space:pre-wrap}
.chips{position:absolute;left:12px;right:12px;bottom:calc(100% + 10px);display:none;flex-wrap:wrap;gap:6px}
.chips.on{display:flex}
.chip{display:flex;align-items:center;gap:6px;background:#0e0e11;border:1px solid #26262a;border-radius:999px;padding:4px 10px;font-size:11px;color:#ddd}
.chip button{border:0;background:transparent;color:#777;cursor:pointer;font-size:12px}.chip button:hover{color:#fff}
.diff-add{color:#4af626}.diff-del{color:#ff6b6b}
```

## 3. Layout and markup

This markup lives in `src/renderer/index.html`; the CSS from section 2 goes in `renderer.css`.

```
┌ explorer 240px ┬────── editor (tabs + textarea/code view) ──────┬ side 380px ───────────┐
│ file tree      │                                                │ [Chat] [CLI] [Agents] │
│ open folder    │                                                │  chat thread / term / │
│ new/rename/del │                                                │  agent run board      │
└────────────────┴────────────────────────────────────────────────┴───────────────────────┘
                         floating PILL (draggable, resizable, bottom-center by default)
```

```html
<div id="wb">
  <section class="pane" id="explorer">
    <div class="ph">explorer <span class="sp"></span>
      <button class="ib" id="openDir" title="open folder">📁</button>
      <button class="ib" id="newFile" title="new file">＋</button></div>
    <div id="tree"></div>
  </section>
  <section class="pane" id="editor">
    <div id="edtabs"></div>
    <textarea id="ed" spellcheck="false"></textarea>
  </section>
  <section class="pane" id="side">
    <div class="tabs"><button class="tab sel" data-t="chat">Chat</button><button class="tab" data-t="cli">CLI</button><button class="tab" data-t="agents">Agents</button>
      <span style="flex:1"></span><button class="ib" id="conn" title="connections">⚙</button></div>
    <div id="chatView"></div><div id="cliView" hidden><div id="term"></div></div><div id="agentView" hidden></div>
  </section>
</div>

<div id="app"> <!-- the pill -->
  <div class="chips" id="chips"></div>
  <div id="thread"><button id="clr" title="clear">✕</button></div>
  <button id="plus" title="attach files">+</button>
  <textarea id="in" rows="1" placeholder="Supru Hunter"></textarea>
  <button id="model" title="model"><span id="mlabel">Thinking</span>
    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  <button id="send" title="Enter">Meow!</button>
  <input type="file" id="file" multiple hidden>
  <div class="pop" id="popModel"><!-- .opt rows per connected model, grouped by provider, then: --></div>
  <div class="pop" id="popConn"><!-- Connections panel, section 7 --></div>
  <div class="rz n" data-d="n"></div><div class="rz s" data-d="s"></div><div class="rz w" data-d="w"></div><div class="rz e" data-d="e"></div>
  <div class="rz nw" data-d="nw"></div><div class="rz ne" data-d="ne"></div><div class="rz sw" data-d="sw"></div><div class="rz se" data-d="se"></div>
</div>
```

The `Chat` tab holds the full conversation history (same `.u/.b/.t/.e` styles as `#thread`). The pill's `#thread` is only a short-lived preview of the latest exchange; the same messages are always mirrored into the Chat tab.

## 4. The pill

- **Size**: default width = 1/3 of the screen (`max(340, innerWidth/3)`), default height = 1/10 of the screen (`max(56, innerHeight/10)`). Default position bottom-center, 24px above the bottom edge.
- **Resize** by dragging any of the 8 handles (all four sides and all four corners). Min 300 x 56. West/north handles must move `left`/`top` so the opposite edge stays fixed. Persist `{w,h}` and `{x,y}` in the app's `settings.json` (see Window below); re-clamp on window resize.
- **Move** by dragging any empty part of the pill (ignore presses on `.rz,.pop,textarea,button`). Use pointer events with `setPointerCapture`. Clamp x to `[-width+60, innerWidth-60]`, y to `[4, innerHeight-40]`.
- **Textarea** grows to 88px; if the pill is shorter than `needed + 24px`, grow the pill (cap 70% of viewport). `Enter` = send, `Shift+Enter` = newline.
- **"+" button = attachments**: opens the hidden `#file` input (multiple). Also accept **drag and drop** of files onto the pill (add `.drop` class while hovering, tan border) and onto the whole window; dropping onto the explorer imports the files into the open folder instead. Show each attachment as a `.chip` (name + ✕) in `#chips` above the pill. Text/code files are read with `FileReader.readAsText` and sent as fenced blocks labelled with the filename; images are sent as base64 only to providers that support vision; other binaries are saved into the project and only referenced by path. Cap one attachment at 1 MB for inline context and say so in a hint when exceeded.
- **"Meow!" button** (right side) = the Enter/submit action. While busy: disabled, label replaced by the three blinking dots; restore label afterwards.
- **Desktop drag and drop**: file objects from the OS give no path in the renderer; call `webUtils.getPathForFile(file)` in the preload to get the real path and pass it to main. Dropping a folder on the window opens it as the project.
- **Window**: the pill lives inside the main window and keeps all behavior above. Persist window bounds and maximized state, and the pill's `{x,y,w,h}` in the app's settings file (`app.getPath('userData')/settings.json`) instead of `localStorage`. Optional: a global shortcut (e.g. `CommandOrControl+Shift+Space`) to show/hide the app and focus the pill, and a tray icon.
- **Slash commands** typed in the pill are handled by the orchestrator (section 10) before anything goes to a model.
- The model chip opens `#popModel` (connected models grouped by provider, plus toggles `agent workflow on/off` and a row `Connections…` that opens `#popConn`). Opening one popover closes the others; clicking outside closes all.

## 5. File explorer and code tools

Left pane = tree of the opened project folder. Implement in main with `dialog.showOpenDialog({properties:["openDirectory"]})` and Node's `fs/promises`; remember the last project root and reopen it on launch. Watch for external changes with `chokidar` (or `fs.watch`) and refresh the tree and open tabs. Features: expand/collapse, click to open in editor tabs, dirty-dot on unsaved tabs, `Ctrl/Cmd+S` save, context menu (new file/folder, rename, duplicate, delete), drag to move, file-type tag on the right (`.tg`), filter box. Ignore `node_modules`, `.git`, `dist` in the tree by default (toggle).

Expose these as one internal **tool API** that both the UI and AI agents call (agents never touch handles directly, so permissions can be enforced in one place):

| Tool | Behavior |
|---|---|
| `fs.list(path)` | directory listing |
| `fs.read(path, range?)` | text content, optionally line range |
| `fs.write(path, content)` | create or overwrite |
| `fs.edit(path, old, new)` | exact-match replace; fail if `old` is missing or not unique |
| `fs.move(from, to)` / `fs.delete(path)` | delete moves the item into `.supru/trash/<timestamp>/` first so it is undoable |
| `fs.search(query, glob?)` | text search across the project |
| `shell.run(cmd)` | main process; runs in the project root, output streamed to the UI |
| `git.status/diff/commit` | main process, via the installed `git` |

Every write/edit/delete produces a diff entry in a change log (`.supru/changes.jsonl`) with agent id, path, before/after hash, and timestamp. Show proposed AI edits as an inline diff (`.diff-add` / `.diff-del`) with Accept / Reject before applying, unless the agent's policy says `auto`. Reject any path that resolves outside the project root (`..`, absolute paths, symlinks).

## 6. Right side: Chat and CLI windows

**Chat tab**: conversation with the currently selected model or with the orchestrator. Streaming when the provider supports it. Code blocks get a "apply to file" button that opens the diff view against the target file.

**CLI tab**: a real terminal. Main spawns shells and CLIs with `node-pty`; the renderer shows them with `xterm.js` (`@xterm/xterm` + `@xterm/addon-fit`, installed from npm and bundled, not loaded from a CDN) over IPC channels `pty:create/write/resize/data/exit`. Style the terminal with background `#050505`, foreground `#4af626`, cursor `#c49a6c`, font 11px mono. Header buttons (use `.tab` style) launch presets: `claude`, `copilot`, `ollama run <model>`, the system shell, plus a free-text "command…" field; detect which CLIs are installed (`where`/`which`) and grey out missing ones with an install hint. Multiple terminals = multiple sub-tabs. Use the project root as `cwd`. The pill can send text to the active terminal with the slash command `/cli <text>`.

## 7. Connections (providers registry)

One registry stores providers; every model picker reads from it. Provider types:

| Type | Examples | How it connects |
|---|---|---|
| `openai-compatible` | build.nvidia.com (`https://integrate.api.nvidia.com/v1`), OpenRouter, Together, Groq, Open WebUI, Ollama (`http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`), llama.cpp server, vLLM | `POST {baseUrl}/chat/completions` with `Authorization: Bearer <key>`; `GET {baseUrl}/models` to auto-list models |
| `anthropic` | Anthropic API | `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version` (called from main, so no browser CORS header is needed) |
| `cli` | Claude Code, GitHub Copilot CLI, Gemini CLI, Codex CLI, any other | main spawns the command in a PTY (interactive) or as a headless child process (agent use) |
| `copilot` | GitHub Copilot | via the Copilot CLI/SDK run by main, see 7b |

The **Connections panel** (`#popConn`, same `.pop` style) lists providers as `.opt` rows with a status tag (`on` green / `off` red) and a `Test` action; "Add provider" shows fields: name, type, base URL, key (password input), default model (select filled from `/models`, or free text). Rules:

- Keys are never written into `supru.agents.json`. Use `keyRef` values: `env:NVIDIA_API_KEY` (read from the environment) or `store:<name>` (saved by the Connections panel). Main stores `store:` secrets with Electron `safeStorage` (encrypted with the OS keychain: DPAPI on Windows, Keychain on macOS, libsecret on Linux) in a file under `userData`, and decrypts only inside main when making a request. The renderer shows `••••` and a `Replace` action, never the key.
- build.nvidia.com free models: user generates an API key there and picks a model id such as `nvidia/nemotron-3-super-120b-a12b`; thinking-capable models may accept `chat_template_kwargs:{enable_thinking:true}`.
- `auto` model = ordered fallback chain across any providers; stop falling back on 401/403.
- Local detection: on load, ping Ollama (`:11434/api/tags`) and LM Studio (`:1234/v1/models`) and add them automatically if they answer.

### 7a. Claude Code CLI

Claude Code is a terminal agent, so it connects as a `cli` provider . Two uses:

1. **Interactive**: launch `claude` in the CLI tab with `cwd` = project root.
2. **Agent mode (headless)**: main runs `claude -p "<task>" --output-format stream-json --verbose` and forwards each JSON line to the Agents tab. Useful flags: `--permission-mode` (`plan`, `acceptEdits`, ...), `--allowedTools "Read,Grep,Bash(npm test)"`, `--max-turns N`, `--model`, `--resume <session_id>` / `--continue`, `--mcp-config file.json`, `--json-schema`, `--input-format stream-json` (multi-turn over stdin). Map an agent's `tools.allow/deny` in the JSON config onto `--allowedTools` / `--disallowedTools` and its `limits.maxTurns` onto `--max-turns`.

Setup checklist to show in the Connections panel: Node.js installed; `npm install -g @anthropic-ai/claude-code`; run `claude` once in a terminal to sign in (Claude subscription or Anthropic Console account) **or** set `ANTHROPIC_API_KEY` in the environment Supru is launched from, or save it through the Connections panel; project opened as `cwd`; optional `CLAUDE.md` in the project root for project instructions. Verify exact requirements and flags against https://code.claude.com/docs because they change between releases. To drive Claude Code with another vendor's model, it needs a gateway that speaks the Anthropic Messages API (set `ANTHROPIC_BASE_URL` plus the gateway's token); treat that as an advanced option and test it.

### 7b. GitHub Copilot

Copilot has no static API key. It authenticates with a GitHub sign-in (OAuth) or a GitHub token, and needs an active Copilot subscription unless you use BYOK. Integrate it through the main process:

- **CLI route (simplest)**: install the Copilot CLI (`npm install -g @github/copilot`), sign in once, then launch `copilot` in the CLI tab or run it headless as an agent.
- **SDK route**: GitHub's Copilot SDK (TypeScript/Python/Go/.NET/Java/Rust) talks to the Copilot CLI in server mode; main hosts it and exposes it as a provider. Auth: signed-in CLI user, or `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN`.
- **Copilot with external models (BYOK)**: the Copilot CLI/SDK can use your own provider instead of GitHub-hosted models via environment variables such as `COPILOT_PROVIDER_TYPE` (`openai` for OpenAI-compatible endpoints incl. Ollama, or `anthropic`), `COPILOT_PROVIDER_API_KEY`, `COPILOT_PROVIDER_WIRE_API` (e.g. `responses`), plus a base-URL variable. Read the exact variable names from GitHub's "Using your own LLM models in GitHub Copilot CLI" docs before coding them, and let the Connections panel fill them from a chosen provider row ("Use this provider for Copilot").
- Inline "tab" completions still run on GitHub's servers; BYOK covers chat/agent use only.

## 8. Main-process services (spec)

All services live in `src/main/` and are reachable from the UI only through named IPC channels exposed by the preload.

| Module | Responsibility | IPC examples |
|---|---|---|
| `fsService.js` | project root, tree, read/write/edit/move/delete (with trash), search, watcher; rejects paths outside the root | `fs:list`, `fs:read`, `fs:write`, `fs:edit`, `fs:delete`, `fs:search` |
| `ptyService.js` | node-pty sessions for the CLI tab and for interactive CLIs | `pty:create`, `pty:write`, `pty:resize`, `pty:kill` |
| `agentRunner.js` | headless CLI runs (e.g. `claude -p ... --output-format stream-json`), parses NDJSON lines into events | `agent:run`, `agent:event`, `agent:stop` |
| `providers.js` | provider registry, `/models` discovery, streaming chat calls (Node `fetch`), fallback chains, local-model auto-detection | `provider:list`, `provider:test`, `chat:send`, `chat:chunk` |
| `secrets.js` | `safeStorage` encrypt/decrypt, `env:` lookup | `secret:set`, `secret:has` (never `get`) |
| `gate.js` | the one permission gate (section 10.4); every tool call from UI or agents passes through it | internal |
| `orchestrator.js` | loads and validates `supru.agents.json`, runs pipelines, checkpoints state | `orch:run`, `orch:approve`, `orch:status` |
| `git.js` | status/diff/commit via the installed `git` | `git:status`, `git:diff`, `git:commit` |
| `settings.js` | window bounds, pill geometry, last project, selected model | `settings:get/set` |

Rules: validate every IPC argument (types, lengths, path containment); stream long outputs in chunks; log every tool call to `.supru/audit.jsonl` inside the project; handle `before-quit` by stopping child processes and saving orchestrator state; allow only one app instance (`app.requestSingleInstanceLock()`).

## 9. Models inside the pill (default catalog)

Seed the model popover with the original groups, now provider-aware: `Thinking` (ultra 550b), `Balanced` (super 120b), `Fast` (lightning 30b), `Auto` (fallback chain), `Local` (Ollama qwen). Replace or extend from the registry; keep each row as `.opt` with a `.tag` showing the model size or provider.

## 10. Autonomous multi-agent orchestration

The orchestrator turns a goal into a pipeline and runs agents defined in **one file: `supru.agents.json`** at the project root. It can be started by commands, and it reads project context from `skill.md`, `README.md`, and `ROADMAP.md`.

### 10.1 Inputs and commands

| Source | Role |
|---|---|
| Pill command | `/run <goal>`, `/plan <goal>`, `/roadmap`, `/roadmap run M2`, `/agents`, `/status`, `/pause`, `/resume`, `/approve`, `/reject`, `/cli <text>` |
| `skill.md` | house rules, coding standards, how-to knowledge; injected into every agent's system context |
| `README.md` | what the project is and how it works; injected as project context |
| `ROADMAP.md` | for big projects: ordered milestones. Parse headings/checklists (`## M2 - Auth`, `- [ ] task`); each milestone becomes its own pipeline run; completed tasks are ticked in the file |
| `supru.agents.json` | the team, permissions, pipeline |
| `.supru/state.json` | run state/checkpoints so a run can pause, crash, and resume |

If a file is missing, continue without it and say so in one line. For a big goal with no `ROADMAP.md`, the planner agent drafts one first and asks for `/approve` before executing.

### 10.2 `supru.agents.json` schema

Top-level keys: `version`, `project`, `sources`, `providers`, `policies`, `agents[]`, `pipeline`, `memory`.

Each **agent** defines everything about one worker:

| Field | Meaning |
|---|---|
| `id`, `role` | unique name and one-line job title |
| `duties[]` | what it must do |
| `boundaries[]` | what it must never do (also compiled into its system prompt) |
| `model` | `{provider, id, temperature, maxTokens, fallback[]}` |
| `tools` | `{allow[], ask[], deny[]}` using tool names from section 5 plus `agent.delegate`, `web.fetch` |
| `fs` | `{read[], write[], deny[]}` glob lists, relative to project root |
| `shell` | `{allow[], deny[]}` command patterns, e.g. `npm test`, `git diff*` |
| `limits` | `{maxTurns, maxTokens, maxCostUsd, timeoutSec}` |
| `inputs[]`, `outputs[]` | artifacts it consumes/produces (file paths under `.supru/artifacts/`) |
| `handoffTo[]` | agents it may delegate to |
| `escalation` | when to stop and ask the human |

### 10.3 Example

```json
{
  "version": "1.0",
  "project": { "name": "my-app", "root": ".", "goal": "Ship the app described in README.md" },
  "sources": { "skill": "skill.md", "readme": "README.md", "roadmap": "ROADMAP.md" },
  "providers": {
    "nim":    { "type": "openai-compatible", "baseUrl": "https://integrate.api.nvidia.com/v1", "keyRef": "env:NVIDIA_API_KEY" },
    "ollama": { "type": "openai-compatible", "baseUrl": "http://localhost:11434/v1" },
    "claude": { "type": "cli", "command": "claude", "args": ["-p", "--output-format", "stream-json", "--verbose"] },
    "copilot":{ "type": "cli", "command": "copilot" }
  },
  "policies": {
    "defaultToolPermission": "deny",
    "humanApproval": ["fs.delete", "git.push", "shell:rm*", "shell:curl*"],
    "budget": { "maxCostUsd": 5, "maxMinutes": 90 },
    "secrets": { "neverRead": [".env*", "**/*.pem", "**/id_rsa*"] },
    "onError": { "retries": 2, "then": "escalate" }
  },
  "agents": [
    {
      "id": "lead", "role": "Orchestrator / tech lead",
      "duties": ["Read skill.md, README.md, ROADMAP.md", "Split the goal into stages", "Assign and verify work"],
      "boundaries": ["Never write product code", "Never skip a quality gate"],
      "model": { "provider": "nim", "id": "nvidia/nemotron-3-ultra-550b-a55b", "temperature": 0.3, "maxTokens": 4096, "fallback": ["ollama:qwen2.5-coder:7b"] },
      "tools": { "allow": ["fs.list", "fs.read", "fs.search", "agent.delegate"], "ask": [], "deny": ["fs.write", "fs.delete", "shell.run"] },
      "fs": { "read": ["**/*"], "write": [".supru/artifacts/**"], "deny": [".env*"] },
      "limits": { "maxTurns": 30, "maxCostUsd": 1, "timeoutSec": 900 },
      "handoffTo": ["planner", "coder", "tester", "reviewer"]
    },
    {
      "id": "planner", "role": "Architect / planner",
      "duties": ["Produce plan.md: stack, files, functions, edge cases, risks"],
      "boundaries": ["No implementation code", "No questions to the user unless blocked"],
      "model": { "provider": "nim", "id": "nvidia/nemotron-3-super-120b-a12b", "temperature": 0.4, "maxTokens": 4096 },
      "tools": { "allow": ["fs.list", "fs.read", "fs.search", "fs.write"], "deny": ["fs.delete", "shell.run"] },
      "fs": { "read": ["**/*"], "write": [".supru/artifacts/plan.md", "ROADMAP.md"] },
      "outputs": [".supru/artifacts/plan.md"]
    },
    {
      "id": "coder", "role": "Implementer",
      "duties": ["Implement tasks from plan.md", "Keep changes small and runnable"],
      "boundaries": ["Only touch src/** and tests/**", "No new dependencies without approval", "Never edit config or CI files"],
      "model": { "provider": "claude", "id": "sonnet" },
      "tools": { "allow": ["fs.read", "fs.write", "fs.edit", "fs.search", "shell.run"], "ask": ["fs.delete"], "deny": ["git.push"] },
      "fs": { "read": ["**/*"], "write": ["src/**", "tests/**"], "deny": [".env*", ".github/**"] },
      "shell": { "allow": ["npm install", "npm run build", "npm test"], "deny": ["rm -rf*", "curl*", "sudo*"] },
      "limits": { "maxTurns": 40, "maxCostUsd": 2, "timeoutSec": 1800 },
      "inputs": [".supru/artifacts/plan.md"], "handoffTo": ["tester"]
    },
    {
      "id": "tester", "role": "QA engineer",
      "duties": ["Write and run tests", "Report failures with reproduction steps"],
      "boundaries": ["Do not change src/**; report to coder instead"],
      "model": { "provider": "ollama", "id": "qwen2.5-coder:7b", "temperature": 0.2 },
      "tools": { "allow": ["fs.read", "fs.write", "shell.run"], "deny": ["fs.delete"] },
      "fs": { "read": ["**/*"], "write": ["tests/**", ".supru/artifacts/test-report.md"] },
      "shell": { "allow": ["npm test"], "deny": ["*"] },
      "outputs": [".supru/artifacts/test-report.md"]
    },
    {
      "id": "reviewer", "role": "Code and security reviewer",
      "duties": ["Review diff for bugs, security, missing imports, style from skill.md"],
      "boundaries": ["Read-only", "Never approve with failing tests"],
      "model": { "provider": "nim", "id": "nvidia/nemotron-3-super-120b-a12b", "temperature": 0.2 },
      "tools": { "allow": ["fs.read", "fs.search", "git.diff"], "deny": ["fs.write", "fs.edit", "fs.delete", "shell.run"] },
      "outputs": [".supru/artifacts/review.md"]
    }
  ],
  "pipeline": {
    "mode": "sequential-with-gates",
    "stages": [
      { "id": "plan",      "agent": "planner",  "goal": "Write plan.md from README/ROADMAP", "gate": { "type": "human" } },
      { "id": "build",     "agent": "coder",    "dependsOn": ["plan"], "retries": 2 },
      { "id": "test",      "agent": "tester",   "dependsOn": ["build"], "gate": { "type": "command", "run": "npm test", "expect": 0 }, "onFail": "build" },
      { "id": "review",    "agent": "reviewer", "dependsOn": ["test"], "gate": { "type": "review", "pass": "no critical findings" }, "onFail": "build" },
      { "id": "summarize", "agent": "lead",     "dependsOn": ["review"], "goal": "Update ROADMAP.md checkboxes and write a short report" }
    ]
  },
  "memory": { "stateFile": ".supru/state.json", "artifactsDir": ".supru/artifacts", "keepRuns": 10 }
}
```

### 10.4 Rules the engine must follow

1. **Permission resolution**: `deny` beats `ask` beats `allow`; anything not listed is denied (`defaultToolPermission:"deny"`). An agent can only narrow `policies`, never widen them.
2. **Enforce in code, not in prompts.** Every tool call goes through one gate that checks tool name, `fs` globs, `shell` patterns, limits, and `policies.humanApproval`. Prompts only describe the rules; the gate applies them. For CLI providers, translate rules into the CLI's own flags (see 7a) *and* keep the main-process gate as a second layer.
3. **`ask` and `humanApproval`** pause the run, show an approval card (tool, args, diff) in the Agents tab with Approve / Reject buttons, and wait.
4. **Context assembly per agent**: its `role/duties/boundaries` as system prompt + `skill.md` + `README.md` + the current milestone + its `inputs` artifacts. Nothing else; do not leak other agents' private context.
5. **Gates**: `human` (wait for `/approve`), `command` (run it, compare exit code), `review` (reviewer agent returns structured pass/fail). On fail, route to `onFail` stage with the failure report as input; stop after `retries`, then follow `policies.onError`.
6. **Checkpoint** after each stage into `.supru/state.json` (stage statuses, artifacts, cost, session ids) so `/resume` continues after a crash or pause.
7. **Budget**: stop and escalate when `maxCostUsd`, `maxMinutes`, or any agent `limits` is hit.
8. **Roadmap flow** for big projects: parse `ROADMAP.md` -> pick next unchecked milestone -> run the pipeline -> tick checkboxes -> continue or pause per `/roadmap run` options.
9. **Validate** `supru.agents.json` on load: unique agent ids, every `handoffTo` and `agent` reference exists, every `provider` exists, no inline secrets (reject values that look like keys), globs are relative. Show errors in the Agents tab; refuse to run until fixed.
10. **Agents tab UI** (same styles): a stage board (`.opt` rows with status tags `queued/running/done/failed`), a live log (`.c` block), approval cards, cost/time counters, and Pause / Stop buttons.

## 11. Project scaffold, build order, packaging

```
supru/
├── package.json            # main: "src/main/main.js"; scripts: start, dist
├── electron-builder.yml    # appId, productName "Supru", icons, targets
├── src/
│   ├── main/               # main.js, fsService.js, ptyService.js, agentRunner.js, providers.js, secrets.js, gate.js, orchestrator.js, git.js, settings.js
│   ├── preload/preload.js  # contextBridge API (window.supru)
│   └── renderer/           # index.html, renderer.css, renderer.js (+ bundled xterm)
├── assets/                 # app icons (.ico, .icns, .png)
└── examples/               # supru.agents.json, skill.md, README.md, ROADMAP.md samples
```

Build order:
1. Electron shell with the secure window settings, then the pill UI and styles (sections 2-4) with persistence in `settings.json`.
2. `fsService` + explorer + editor + diff view (section 5).
3. Provider registry, Connections panel, Chat tab (section 7), starting with `openai-compatible` and Ollama.
4. `ptyService` + CLI tab, then `agentRunner` for headless Claude Code / Copilot runs (7a, 7b).
5. `gate.js`, then the orchestrator, `supru.agents.json` validator, and the Agents tab (section 10).
6. Test end to end on a sample project with a 3-milestone `ROADMAP.md` before packaging.

Packaging so it installs like a normal app: use `electron-builder` (`npm run dist`) to produce a Windows installer (`.exe`/NSIS), a macOS `.dmg`, or a Linux `.AppImage`/`.deb`, built on the matching OS (or via CI). Mark `node-pty` as unpacked from asar (`asarUnpack`). Unsigned apps trigger Windows SmartScreen / macOS Gatekeeper warnings; code signing is optional for personal use and required for public distribution. Optional later: `electron-updater` for auto-updates.

Deliver the whole project folder (not a single file), with a short `README.md` showing: `npm install`, `npx electron-rebuild`, `npm start` for development, and `npm run dist` for the installer.
