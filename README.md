# BlockForge 5.6 — Stability & Release Edition

Bilingual, offline-first structural building, engineering and demolition game created by Laura Andreea for the CodePen Blocks Challenge.

## Live pages

- Landing: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/
- Game: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/play.html
- Portfolio demo: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/play.html?embed=1
- Quality Gate: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/tests.html
- Architecture: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/architecture.html
- Release notes: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/release-notes.html
- Documentation: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/docs.html
- Known issues: https://laurandreea10.github.io/BlockForge-CodePen-Challenge-Blocks/known-issues.html

## Highlights

- 12+ building, demolition, campaign, survival, versus, blueprint, puzzle, boss, bridge, rescue and defense experiences
- Seven structural materials and six demolition tools
- Engineer View, pressure maps, center of mass and collapse prediction
- Cinematic replay, WebM recording, PNG cards and before/after comparison
- Profiles, XP, achievements, tournaments, creators, statistics and local backups
- Visual tutorial, Continue Playing, Command Palette and Help Center
- Romanian and English interface
- Keyboard, touch, gamepad, reduced motion, high contrast, scene descriptions and speech support
- Installable PWA with offline support
- No accounts, Firebase, Supabase or external database

## Stability & Release Edition

Version 5.6 adds a runtime Stability Center with:

- functional audit and PASS/FAIL checks
- exportable diagnostics
- local JavaScript error log
- last-action tracking
- performance measurements and a 2-second startup target
- low-power mode
- versioned schema migration and safety backup
- architecture and release documentation
- SEO metadata, sitemap and robots file
- extended browser Quality Gate

## Controls

- Tap/click a grid cell: place a block
- Drag empty stage: orbit camera
- Mouse wheel or pinch: zoom
- `G`: gravity
- `Delete`: remove selection
- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + K`: Command Palette
- `Escape`: close active dialog

## Architecture

The project uses a stable three-file core (`core.js`, `game.js`, `ui.js`) and progressive feature modules. DOM + CSS 3D rendering keeps the experience dependency-free. Versioned localStorage keys and JSON exports provide local persistence and portable backups.

## Testing

Open `tests.html` to run the browser Quality Gate. The Stability Center inside the game performs additional runtime checks and exports a diagnostic JSON file.

## Compatibility

Modern Chromium browsers provide the broadest feature set. Firefox and Safari support the core game, while MediaRecorder, Web Speech, vibration, Web Share and gamepad behavior can vary by browser and device.

## Privacy

All gameplay and profile data stays in the browser or in files explicitly exported by the user.

---

## Română

BlockForge 5.6 este un joc structural 3D bilingv, offline-first, cu construcție, demolare, analiză inginerească și prezentare de portofoliu.

Ediția 5.6 adaugă audit funcțional, diagnostic exportabil, jurnal local de erori, buget de performanță, mod economic, migrare sigură, documentație de arhitectură, SEO și teste extinse. Proiectul nu utilizează Firebase, Supabase, conturi sau baze de date externe.
