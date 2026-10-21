# OpenCode lesson generation

## Teaching team in the current source

`src/education/teachingAgents.ts` defines 12 subject teachers, 24 subject-specific
skills, three shared skills and four reviewer skills. Subject selection is an
exact application lookup; no classifier or additional paid API is required.
The teacher's instructions enter the existing generation prompt. The existing
offline demonstration mode remains separate from these model-backed reviews.

`review_with_agents: true` opts into Didactics, Assessment, Sources and Inclusion
reviews through `server/ai/teacherReview.ts`. Reviewers receive independent
OpenCode sessions with the existing restricted permissions and free-model
catalogue. Each gets the same lesson and selected source excerpts, with no
earlier review supplied as evidence. Reviews do not execute generated code.

The pending lesson is saved before review. A content fingerprint, session IDs
and completed reports are checkpointed with the job. Resume reuses completed
reports only for the same content and team version; a failed reviewer or local
database write does not regenerate the teacher's answer. If all reviews are
already saved, a database retry does not need the model catalogue. Review JSON
has bounded fields and must refer to actual scenes. Malformed replies get at
most one repair attempt. Cancellation and failures retain the pending answer.

`pedagogical_team` records the actual teacher profile and completed reviews in
the saved lesson; application code assigns this metadata. Historical pending
jobs without a profile version do not acquire false authorship retroactively.
The editor identifies the reviewed version, shows concrete suggestions, and
always retains human review. The reviewers do not browse or verify missing
sources; the Sources role must record that limitation. Altering a saved lesson
does not rerun review automatically.

Regression tests use a controlled bridge, a real browser and disposable PostgreSQL.
The .8 clean-test edition was also exercised in the installed Windows application
with real free OpenCode responses: one science lesson, four independent reviews,
versioned UI editing, offline presentation and quiz, HTML/JSON export and a print
document rendered to PDF. Completed generation was retained across the print fix;
it was not replaced with a fixture or regenerated unnecessarily. See
RELATORIO-PEMARA-EDU-8.txt for exact artifact hashes, coverage and limitations.
Neither automated success nor AI review establishes pedagogical acceptance.

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
