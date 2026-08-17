# Fixed Video Speed

Chrome MV3 extension that pins HTML5 video playback speed on supported sites
and user-added custom domains, so the player can't silently reset it.

## Features

- **Built-in support** for YouTube, Bilibili, TikTok, Twitch, Netflix,
  Disney+, Coursera, Udemy, Facebook Video, X, Reddit Video, and Dailymotion
  (matched by hostname, including subdomains).
- **Custom domains** — add any site from the popup; each domain gets its own
  speed.
- **Speed profiles** — named speed presets that can be assigned to sites or
  custom domains, selectable from the dashboard dropdown.
- **Speed range 0.25×–16×** in 0.05 steps, with a speed dial and quick
  buttons in the popup.
- **On-page speed badge** — an overlay on the video shows the enforced speed.
- **Playback statistics** — watch time per site is tracked and shown in the
  statistics tab; data can be exported/imported/reset from the data page.
- **Live popup dashboard** — the popup talks directly to the content script
  to show the current video state and apply speed changes instantly.
- Enable/disable toggle per extension; settings sync through `chrome.storage`.

## Popup tabs

| Tab | Purpose |
| --- | --- |
| Dashboard | Current video state, speed dial, profile selector, apply/preview |
| Sites | Per-site speeds and custom domain management |
| Statistics | Watch-time stats per site |
| Data | Import / export / reset settings and statistics |
| Settings | Extension-wide options |

## Development

```bash
npm install
npm run build        # typecheck + popup/background build + content-script build → dist/
npm run typecheck    # tsc -b --noEmit
npm run lint         # oxlint
```

Load the generated `dist/` directory from `chrome://extensions` with
Developer mode enabled. After code changes, rebuild and reload the extension.

## Architecture

- **Content script** (`src/content/`) does the heavy lifting: a
  MutationObserver finds `<video>` elements, `VideoController` enforces the
  resolved speed, `OverlayService` renders the badge, and
  `StatisticsService` aggregates playback events.
- **Popup** (`src/popup/`) is React 19; it reads/writes settings via
  `chrome.storage` and queries the active tab's content script directly
  (`fvs:`-prefixed messages, no background relay).
- **Background** (`src/background/`) is currently a placeholder service
  worker.

Speed resolution precedence: custom-domain profile speed → custom-domain
speed → site profile speed → per-site speed → legacy global speed → 1×.

Built with TypeScript, React 19, and Vite (two configs: popup + background,
and the content script as a standalone IIFE).
