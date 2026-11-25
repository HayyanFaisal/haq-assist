# Codex task: audit the new Haq Assist web UI

Read `D:\Codex Folder\GenAIProject.md` for your general rules. You are the independent auditor. Do not modify any source file; write your report only.

**What changed:**
- The web app in `frontend/` (`index.html`, `styles.css`, `app.js`, `assets/`) was fully redesigned.
- The backend gained:
  - `POST /api/ask/stream`, which streams NDJSON progress events from `backend/engine.py` via an `emit` callback;
  - `GET /api/library`.
- Features:
  - A live "pipeline" view of the real engine events. It is played back with a short minimum gap and can be toggled in Settings.
  - A Settings `<dialog>` with switches.
  - Plans (Free 8, Haq Go 40, Haq Plus 80, Haq Ultra 150 questions a month; Rs 0 / 149 / 599 / 899), with a demo usage meter kept in localStorage.
  - View transitions between routes.
  - Reduced-motion support.
  - Urdu (RTL) text.

**Check and report** in `frontend/UI_AUDIT.md`, with `file:line` for each finding, severity (high, medium, low) and a one-line fix:

1. **Correctness:**
   - JS errors and race conditions, e.g. asking twice, navigating away mid-stream, or the stream ending without a result.
   - NDJSON parsing across chunk boundaries.
   - The Trace class logic.
   - Event handlers on re-render.
   - Usage counting.
   - Plan switching.
2. **Security:**
   - Every server or model value inserted with `innerHTML` must go through `esc()`, and every link through `safeUrl()`. List any that do not.
   - The streaming endpoint must not leak exceptions or block the server thread.
3. **Accessibility:**
   - labels and accessible names (check that `#q` and `#region` have proper names);
   - the switches (`input[switch][role=switch]`);
   - the dialogs (native `<dialog>`, `aria-labelledby`, focus);
   - live regions (not too chatty);
   - focus after route change;
   - colour contrast of the muted and faint text tokens on the navy backgrounds (compute the ratios);
   - keyboard use of the composer (Enter submits, Shift+Enter makes a new line, IME composition).
4. **Modern web practice:**
   - `@starting-style` / `allow-discrete` / `overlay` usage;
   - view-transition names unique at any time;
   - scroll-driven animations gated by `@supports` and reduced motion;
   - no layout-thrashing animations.
5. **Mobile:** fixed bottom nav, safe areas, anything likely to overflow at 360px.
6. **Honesty of copy:** nothing on the Plans page or the home page that claims a feature that doesn't exist. Planned features must be marked.

Keep the report under 120 lines and rank findings high first.
