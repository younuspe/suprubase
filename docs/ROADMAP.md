# Supru Roadmap

Goal: an installable desktop app (Electron) for Windows/macOS/Linux, built from `.claude/skills/supru-style/SKILL.md`.

Rules for working through this file:
- Do one milestone at a time, in order. Do not start the next milestone until the current one's "Done when" checks pass.
- Tick a task `[x]` only after you have run the app or a command and seen it work. Say how you verified it.
- If a check fails, fix it before moving on. If something is blocked (missing tool, unclear requirement), stop and report it instead of guessing.
- Keep the visual style exactly as defined in the skill (colors, radii, fonts). Do not invent new styles.

---

## M0 - Project shell

Set up the Electron project with the secure window settings.

- [ ] `package.json` with scripts `start` and `dist`; folders as in the skill (section 11)
- [ ] Main process opens one window; `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, strict CSP
- [ ] Preload exposes an (initially tiny) `window.supru` API via `contextBridge`
- [ ] Single-instance lock; window bounds saved to `settings.json` in `userData`
- [ ] Short `README.md`: prerequisites, `npm install`, `npm start`

**Done when:** `npm install && npm start` opens a dark window (`#0a0a0c`) with no console errors, and closing and reopening restores the window size and position.

---

## M1 - The pill

Exact Supru pill with all interactions, before any AI.

- [ ] Pill markup and CSS verbatim from the skill (section 2a); `Meow!` send button
- [ ] Default size: 1/3 screen width, 1/10 screen height; bottom-center
- [ ] Resize from all 4 sides and 4 corners (min 300 x 56); west/north handles keep the opposite edge fixed
- [ ] Drag by empty pill area; position clamped to the window
- [ ] Textarea auto-grows to 88px and grows the pill if needed; Enter sends, Shift+Enter newline
- [ ] `+` opens a file picker; drag and drop files onto the pill; attachments shown as chips with remove button
- [ ] Pill `{x,y,w,h}` persisted and restored after restart
- [ ] Model chip opens a popover (placeholder rows); outside click closes popovers
- [ ] Meow! shows blinking dots while busy and restores afterwards

**Done when:** I can drag and resize the pill from every edge and corner, attach 2 files by button and 1 by drag-and-drop, type a multi-line message, press Enter, and after restarting the app the pill is where and how big I left it.

---

## M2 - Workbench layout and file explorer

- [ ] Three-pane layout: explorer (240px), editor, side panel (380px) with Chat / CLI / Agents tabs
- [ ] `fsService` in main: open folder dialog, list, read, write, edit (exact-match replace), move, delete-to-trash (`.supru/trash/`), search; paths outside the project root are rejected
- [ ] Tree with expand/collapse, open file in editor tab, dirty dot, `Ctrl/Cmd+S` to save
- [ ] Context menu: new file/folder, rename, duplicate, delete; ignore `node_modules`, `.git`, `dist` by default
- [ ] File watcher refreshes tree and open tabs on external changes
- [ ] Remembers the last project on launch

**Done when:** I can open a real folder, create, edit, save, rename and delete a file from the UI, see a deleted file in `.supru/trash/`, and an attempt to read `../outside.txt` through the IPC API is rejected.

---

## M3 - Chat with models

- [ ] `providers.js`: registry stored in `userData`; types `openai-compatible` and `anthropic`
- [ ] Connections panel: add provider (name, type, base URL, key, default model), Test button, `/models` discovery, status tag
- [ ] Keys saved with `safeStorage`; the UI never receives the real key
- [ ] Auto-detect Ollama (`:11434`) and LM Studio (`:1234`)
- [ ] Chat tab and pill preview thread; streaming responses; errors shown in red
- [ ] Attachments sent as fenced blocks labelled with the filename
- [ ] `Auto` model = fallback chain; stops falling back on 401/403
- [ ] Code blocks have "apply to file" which opens a diff with Accept / Reject

**Done when:** with Ollama running, I can chat with a local model; with a build.nvidia.com key, I can chat with a cloud model; the key is not visible anywhere in the UI or in plain text on disk; accepting a diff changes the file and rejecting leaves it untouched.

---

## M4 - CLI window

- [ ] `ptyService` with `node-pty`; xterm.js (bundled from npm) in the CLI tab
- [ ] Terminal styled per the skill (`#050505` background, `#4af626` text, tan cursor)
- [ ] Preset buttons: system shell, `claude`, `copilot`, `ollama run <model>`; missing CLIs greyed out with an install hint
- [ ] Multiple terminal sub-tabs; correct resize; project root as working directory
- [ ] `/cli <text>` in the pill writes to the active terminal

**Done when:** I can open a shell, run `git status` in my project, start `claude` (if installed) and use it interactively, open two terminals at once, and resize the window without garbled output.

---

## M5 - Claude Code and Copilot as providers

- [ ] `agentRunner`: run `claude -p "<task>" --output-format stream-json --verbose` as a child process, parse each JSON line into events shown in the Agents tab
- [ ] Support `--permission-mode`, `--allowedTools`, `--max-turns`, `--resume`; verify flag names against https://code.claude.com/docs before using them
- [ ] Connections panel shows a setup checklist for Claude Code (Node, install command, sign-in or `ANTHROPIC_API_KEY`)
- [ ] GitHub Copilot: launch the Copilot CLI in the terminal; headless run if supported; bring-your-own-key fields filled from a chosen provider (read exact variable names from GitHub's docs first)
- [ ] Stop button kills the child process cleanly

**Done when:** from the pill I can send a task to Claude Code, watch its streamed events, see the files it changed appear in the explorer, and stop it mid-run. Copilot CLI launches in the terminal tab.

---

## M6 - Permission gate and change log

- [ ] `gate.js`: one function every tool call passes through; checks tool name, `fs` globs, `shell` patterns, limits; `deny` beats `ask` beats `allow`; default deny
- [ ] Approval cards (Approve / Reject) for `ask` and `humanApproval` actions
- [ ] Every write/edit/delete logged to `.supru/changes.jsonl`; every tool call to `.supru/audit.jsonl`
- [ ] Secrets globs (`.env*`, `*.pem`, `id_rsa*`) unreadable by agents
- [ ] Unit tests for the gate (allow, ask, deny, path escape, glob match, shell pattern)

**Done when:** tests pass; a test agent that tries to delete a file, read `.env`, or run `rm -rf` is blocked or asks for approval exactly as configured.

---

## M7 - Orchestrator

- [ ] `supru.agents.json` loader and validator: unique ids, valid references, no inline secrets, relative globs; errors shown in the Agents tab
- [ ] Context assembly per agent: role/duties/boundaries + `skill.md` + `README.md` + current milestone + its input artifacts
- [ ] Pipeline engine: stages, `dependsOn`, gates (`human`, `command`, `review`), retries, `onFail` routing
- [ ] Budget and time limits enforced; escalation to the human when exceeded
- [ ] Checkpoints in `.supru/state.json`; `/pause`, `/resume`, `/stop`, `/approve`, `/reject`, `/status`
- [ ] Commands: `/run <goal>`, `/plan <goal>`, `/agents`
- [ ] Agents tab: stage board, live log, approval cards, cost/time counters
- [ ] Example `supru.agents.json` (lead, planner, coder, tester, reviewer) in `examples/`

**Done when:** `/run "add a hello-world function and a test"` on a small sample project goes plan -> build -> test -> review, stops at the human gate for `/approve`, passes the test command gate, and I can kill the app mid-run and `/resume` to finish.

---

## M8 - Roadmap-driven projects

- [ ] Parse `ROADMAP.md` headings (`## M2 - Name`) and checkboxes
- [ ] `/roadmap` lists milestones and status; `/roadmap run M2` runs one milestone through the pipeline
- [ ] Ticks completed checkboxes in `ROADMAP.md` after gates pass
- [ ] If there is no roadmap for a big goal, the planner drafts one and waits for `/approve`
- [ ] `skill.md` and `README.md` are injected into agent context; missing files are reported in one line, not fatal

**Done when:** on a sample project with a 3-milestone `ROADMAP.md`, `/roadmap run M1` completes, ticks its boxes, and `/roadmap` shows M1 done and M2 next.

---

## M9 - Packaging and polish

- [ ] `electron-builder.yml`; `npm run dist` produces an installer for the current OS (`asarUnpack` for node-pty)
- [ ] App icon; app name "Supru"
- [ ] Global shortcut to show/hide and focus the pill (optional tray icon)
- [ ] Error boundaries: no uncaught exceptions on provider failures, missing CLIs, or denied permissions
- [ ] Final README: install, first-run setup (connections, Claude Code sign-in), example workflow

**Done when:** I can install the built app on this laptop like a normal program, launch it from the Start menu / Applications, and run through M1-M8 checks again from the installed version.
