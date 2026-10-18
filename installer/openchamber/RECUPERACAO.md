# Recovery after interruption

The UI must use a successful active-session snapshot as the authority for live work. An unfinished historical assistant message remains visible, but cannot keep the activity indicator or stop button active after the motor confirms that the session is idle. Failed reads retain the prior state. Resume is an explicit new message in the same conversation; reconnection does not resubmit prompts or repeat file operations.

Affected runtimes before editing:

- Electron desktop: shared activity and interrupted-reply notice, tested in the installed Windows package.
- Web: the same shared state rules; no new HTTP routes.
- VS Code: the same shared state rules, using its existing status snapshot adapter; no bridge changes.
- Hosted mobile: the same shared state rules; no transport changes.
- Capacitor mobile: the same shared state rules; no native changes.

Owner: `useSessionActivity` derives the indicator from directory-scoped live status and snapshot readiness. `SessionErrorNotice` explains an idle unfinished reply after refreshing its messages. Message storage, IDs and file content are unchanged. Repeated idle snapshots must not trigger periodic scans or replay. No dependency, engine or provider changes.

Preservation: profile, lessons, installer sources and changed upstream source files copied to `build/openchamber/2.4.0-pemara.3/originais` before edits. Earlier installer remains available. The lesson generator specific to PEMARA EDU and Atlas are not embedded in OpenChamber; this package provides AI chat that creates standalone HTML lessons.
