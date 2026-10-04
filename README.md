# Supru

## Prerequisites
- Node.js LTS (v18+ recommended)
- npm
- Git

## Installation
```bash
npm install
```

## First-Run Setup
1. After installing, run the app: `npm start`
2. On first launch, you'll see the Supru pill at the bottom center
3. Click the "+" button on the pill to attach your project folder
4. Go to the Connections tab in the side panel to configure AI providers:
   - For local models: Add an Ollama provider pointing to http://localhost:11434
   - For cloud models: Add an OpenAI-compatible provider with your API key
   - API keys are stored securely using the system's safe storage and never exposed in the UI
5. (Optional) Install Claude Code or GitHub Copilot CLI for agent functionality:
   - Claude Code: `npm install -g @anthropic-ai/claude-code`
   - GitHub Copilot: Follow installation instructions at https://github.com/features/copilot

## Usage
- Drag and resize the pill from any edge or corner
- Attach files by clicking "+" or dragging onto the pill
- Send messages via the pill: Enter sends, Shift+Enter for newline
- Use the three-pane layout: explorer (left), editor (center), side panel (right) with Chat / CLI / Agents tabs
- In the Agents tab, you can run AI agents using commands like `/run "add a hello-world function"`

## Packaging
```bash
npm run dist
```
This creates platform-specific installers in the `dist/` directory.

## Example Workflow
1. Open a project folder via the pill's file picker
2. In the Agents tab, type `/run "create a REST API server with user authentication"`
3. The orchestrator will plan the workflow (if agents are configured)
4. Review and approve each stage via the approval cards that appear
5. Watch the agent's progress in the live log
6. Accept or reject code changes via the diff interface when prompted
7. Completed work appears in the explorer and can be saved with Ctrl/Cmd+S

## Troubleshooting
- If the app fails to start, check `electron.out` for error logs
- For provider connection issues, verify API keys and network accessibility
- Agent execution requires the respective CLI tools to be installed and in PATH