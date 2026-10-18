# OpenCode lesson generation

The teacher's main action sends the lesson brief and reviewed materials to the model configured in OpenChamber. A dedicated OpenCode conversation retains the request and response; validated lessons are saved to the existing library and exported by the existing renderer. Atlas model IDs come from the real catalogue, not generated HTML or scripts.

## Surfaces and ownership

- Electron PEMARA distribution: native adapter resolves the current local runtime and model, using the installed official SDK. The education backend owns validation, persistent jobs and library writes.
- Standalone PEMARA web: existing providers and offline creation remain available; OpenCode jobs return unsupported when no adapter is installed.
- Shared OpenChamber web: unchanged.
- VS Code: unchanged, education capability not installed.
- Hosted mobile: unchanged, education capability not installed.
- Capacitor mobile: unchanged, education capability not installed.

The teacher UI receives no runtime credentials. Every SDK call names the teacher project directory. Generation sessions deny tools: the model returns a structured lesson, and application code performs validated writes. Other chat sessions keep their existing permissions. Jobs retain the input and session after interruption; retry is explicit and reuses the conversation. No automatic downgrade to generation without AI.

Version .4 and its installer are preserved. Version .5 changes the distribution without adding packages or changing the existing chat engines.
