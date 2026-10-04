# Supru - project instructions for Claude Code

Supru is an installable desktop app (Electron) for coding with AI: a floating pill input, file explorer, editor, Chat / CLI / Agents side panel, model connections, and a JSON-driven multi-agent orchestrator.

## Read these first
- `.claude/skills/supru-style/SKILL.md` is the full specification: visual style (exact CSS), architecture, tool API, connections, orchestration schema. Follow it. Do not restyle anything.
- `ROADMAP.md` is the work plan. Work on one milestone at a time, in order.

## How to work
1. Before starting a milestone, read its tasks and its "Done when" line. Summarize the plan in a few lines.
2. Build only what the current milestone asks for. Do not add features from later milestones.
3. After building, actually run it (`npm start`, tests, or a script) and check the "Done when" conditions. Report what you ran and what you saw.
4. Tick a checkbox in `ROADMAP.md` only for things you verified. If you could not verify something (for example, the UI needs me to click), say so and leave it unticked.
5. If something fails or is unclear, stop and tell me. Do not guess, do not fake output, and do not mark work as done when it is partial.
6. Keep changes small and committed per milestone with a clear message (`git commit -m "M1: pill"`), but never push without asking.

## Architecture rules (non-negotiable)
- Three layers: `src/main` (Node: files, PTY, git, providers, secrets, gate, orchestrator), `src/preload` (contextBridge only), `src/renderer` (UI only).
- Renderer has no Node access and no secrets. Window settings: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, strict CSP.
- Every IPC handler validates its arguments (types, lengths, path containment inside the project root).
- Every tool call from the UI or from an agent passes through `gate.js`. Permissions are enforced in code, never only in prompts.
- API keys: stored with Electron `safeStorage`, decrypted only inside the main process, never sent to the renderer, never written to `supru.agents.json`, logs, or git.
- Deletes go to `.supru/trash/` first. Writes, edits and deletes are logged to `.supru/changes.jsonl`.
- Do not read, print, or commit `.env*`, `*.pem`, `id_rsa*`, or any real credentials.

## Style rules
- Use the colors, radii, fonts and shadows in SKILL.md section 1 and the CSS in section 2 exactly. No new colors, no light theme, no external fonts or icon libraries (inline SVG only).
- The send button label is `Meow!`. The pill defaults to 1/3 screen width and 1/10 screen height.
- UI code is plain HTML/CSS/JS unless I ask for a framework.

## Tech and commands
- Node.js LTS, npm, Git. Electron + `electron-builder`; terminal via `node-pty` + `@xterm/xterm`.
- `npm install`, then `npx electron-rebuild` after installing or updating native modules.
- `npm start` runs the app in development. `npm run dist` builds the installer.
- If `node-pty` fails to compile, report the exact error and the missing build tool (Windows: Visual Studio C++ build tools + Python; macOS: Xcode command line tools; Linux: `build-essential` + Python) before trying workarounds.

## Facts to verify, not assume
- Claude Code CLI flags: check https://code.claude.com/docs before using any flag. Headless runs use `claude -p ... --output-format stream-json --verbose`.
- GitHub Copilot CLI bring-your-own-key environment variable names: read GitHub's "Using your own LLM models in GitHub Copilot CLI" docs first.
- build.nvidia.com model ids and endpoints: confirm with a real `/models` call.

## When you finish a milestone
Reply with: what was built, how you verified each "Done when" item, anything left unticked and why, and the one thing I should test by hand.
