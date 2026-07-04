# Migrating this folder to TikiBlanco.online (production)

This folder is the complete, self-contained TikiBlänco game-night package.
It was developed on the `claude/tiki-blanco-interactive-game-bomjft` branch
of `ToodlesMalone/frontend-projects` and is meant to ship on the
TikiBlanco.online site. No build step, no external dependencies.

## Contents

| File | What it is |
|---|---|
| `play.html` | Game-night selector page: Tiki Snake or Blood Moon Canyon |
| `snake.html` | Complete tiki-themed snake game (stand-in — see step 3) |
| `index.html` | Blood Moon Canyon — the 3D explorable poster game |
| `js/game.js` | All game code for Blood Moon Canyon |
| `js/three.module.min.js` | Vendored Three.js r160 (MIT) |
| `poster.jpg` | Title/backdrop art |
| `audio/*.mp3` | The two soundtrack songs |

## Steps

1. Copy the entire `tiki-blanco/` folder into the TikiBlanco.online repo.
   Any location works — all paths inside are relative. Suggested:
   repo root as `tiki-blanco/` (URLs become `/tiki-blanco/play.html`).
2. Point the site's Play page/nav at `tiki-blanco/play.html`.
3. Snake: the site may already have its own snake game. Either keep the
   bundled `snake.html`, or edit ONE line in `play.html` — change
   `href="snake.html"` on the Tiki Snake card to the existing game's path.
4. Commit to the deploy branch and ship the way the site normally deploys.

## Pre-launch smoke test (on the live HTTPS URL — ES modules will not
run from a file:// open)

- [ ] `play.html` loads on phone + desktop; both cards open their games
- [ ] Canyon: ENTER starts music + intro swoop; walking, swimming, and
      the Bronco (DRIVE button / E) all work
- [ ] Reload the canyon: discovery progress persists (localStorage)
- [ ] Snake: swipe steers on mobile, arrows on desktop, best score saves
- [ ] `.mp3` files stream (host must serve audio/mpeg — any normal host does)

## Notes

- The discovery jingle is an original WebAudio homage to the classic
  "secret found" sound, not Nintendo's recording. Keep it that way for a
  commercial site.
- `poster.jpg` contains the older "ã" spelling baked into the artwork;
  replacing that file updates the title screens automatically.
- Total size ≈ 11 MB, dominated by the two songs and the poster.
