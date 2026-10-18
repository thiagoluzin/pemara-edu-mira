# OpenCode lesson generation

The teacher's main action sends the brief and reviewed materials to a free cloud model selected from OpenCode's live catalogue. It requires explicit zero input, output and cache prices on every tier, enabled status, text output and sufficient output capacity. Paid, unknown-price and local models are excluded. Failure advances to the next candidate in the same conversation. The last working model is preferred only while it remains free and available. The teacher does not configure models or use a terminal.

A dedicated OpenCode conversation retains the request and response; validated lessons are saved to the existing library and exported by the existing renderer. Atlas model IDs come from the real catalogue, not generated HTML or scripts. Every attempt and its outcome are persisted. Structured-output repair is bounded; cancellation stops the sequence, and exhaustion retains the request for explicit retry.

Selection is independent of a model manually selected in chat. A validated response is persisted before writing the library; if storage fails, Resume saves that answer without another generation. Migration 008 widens lesson topics to TEXT, matching the form's existing 2000-character allowance without truncating older data. Exact one-field Atlas wrappers `{id: string}` are normalized to their ID; unknown IDs and incompatible subjects remain rejected.

## Surfaces and ownership

- Electron PEMARA distribution: native adapter resolves the current local runtime and model, using the installed official SDK. The education backend owns validation, persistent jobs and library writes.
- Standalone PEMARA web: existing providers and offline creation remain available; OpenCode jobs return unsupported when no adapter is installed.
- Shared OpenChamber web: unchanged.
- VS Code: unchanged, education capability not installed.
- Hosted mobile: unchanged, education capability not installed.
- Capacitor mobile: unchanged, education capability not installed.

The teacher UI receives no runtime credentials. Every SDK call names the teacher project directory. Generation uses OpenCode's standard planning agent; shell, edits, writes and external-directory access are denied in that dedicated session. Application code validates and saves the returned lesson. Other chat sessions keep their existing permissions. OpenCode creates native session/message IDs; job metadata links requests to them, allowing recovery after queued work and preventing a stale earlier answer from being mistaken for the current response. The adapter waits for the matching completed answer, including when the runtime initially reports idle. No automatic downgrade to generation without AI.

Versions .4 and .5 and their installers are preserved. Version .6 requires no local model or special GPU on the teacher's notebook and adds no packages. Generation requires internet and service availability; saved lessons and exported HTML work offline. Automatic selection cannot promise permanent availability of a third-party free tier.
