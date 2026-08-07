# HANDOFF — TikiBlänco Game Night → TikiBlanco.online (production)

**For:** a new Claude Code session on Rodd's Mac (desktop app, local git access)
**Date:** 2026-07-29
**Prior work:** built and tested in a Claude Code cloud session on
`ToodlesMalone/frontend-projects`, branch `claude/tiki-blanco-interactive-game-bomjft`.
That session could not access the private TikiBlanco.online repo, hence this handoff.

---

## 1. What this project is

A self-contained browser "game night" package for the TikiBlänco website
(tikiblanco.com / tikiblanco.online — the tiki bar in Blanco, Texas).
Everything lives in ONE folder: `tiki-blanco/`. Static files only — no build
step, no CDN, no server code. Three.js r160 is vendored inside.

| File | Purpose |
|---|---|
| `play.html` | Game-night selector page (two cards: Tiki Snake / Blood Moon Canyon) |
| `index.html` | **Blood Moon Canyon** — 3D explorable version of the TikiBlänco poster |
| `js/game.js` | All canyon game code (~3k lines, vanilla ES module) |
| `js/three.module.min.js` | Vendored Three.js r160 (MIT) |
| `snake.html` | Tiki Snake — complete stand-in snake game |
| `poster.jpg` | Original poster art (title screens; note: has older "ã" spelling baked in) |
| `audio/moontower.mp3`, `audio/roe-v-wade.mp3` | Rodd's two soundtrack songs |
| `MIGRATION.md` | Migration runbook (same info as §3, kept with the code) |
| `README.md` | Feature overview + controls |

Blood Moon Canyon in one paragraph: N64-Zelda-style low-poly night canyon.
You play a little tiki man hunting **25 discoveries** (3 are secret with no
map marker). Includes: Wynonna (Rodd's real dog — follows you, plays fetch),
Winnie (his big dog — sleeps in his own den), a drivable green Bronco
(Rodd's real truck) with radio, a canoe, fishing, five collectible tiki
mugs, a hidden tiki-bar grotto modeled on the real bar's interior (stage,
mask wall, neon sign, blowfish lamp), Rodd's tattoo as a hidden petroglyph,
Hill Country cryptids (Bigfoot, chupacabra, the Watcher), Bevo, a vineyard
with a wine speed-boost, blood-moon events, photo mode, a speedrun clock,
and Rodd's two songs rotating with spooky synth interludes. Progress saves
to localStorage. Verified end-to-end in headless Chromium: all 25
discoveries, both vehicles, fishing, mugs, completion — zero console errors.

## 2. The mission

Move `tiki-blanco/` into the **private repo `ToodlesMalone/TikiBlanco.online`**,
wire it into the site's Play page, open a PR, and deploy via Cloudflare.

## 3. Exact steps (local terminal / Claude desktop)

```bash
# 1. get the destination repo (uses YOUR local git credentials)
git clone git@github.com:ToodlesMalone/TikiBlanco.online.git
cd TikiBlanco.online
git checkout -b add-game-night

# 2. pull the game folder out of the dev branch on frontend-projects
git remote add fp https://github.com/ToodlesMalone/frontend-projects.git
git fetch fp claude/tiki-blanco-interactive-game-bomjft
git checkout fp/claude/tiki-blanco-interactive-game-bomjft -- tiki-blanco
git remote remove fp

# 3. commit + push + PR
git add tiki-blanco
git commit -m "Add TikiBlänco game night: play page, Tiki Snake, Blood Moon Canyon"
git push -u origin add-game-night
```

Then, before the PR:

- **Inspect the existing site structure.** Find the current Play page /
  nav. Link it to `tiki-blanco/play.html`.
- **Snake:** if the site already has its own snake game, edit one line in
  `tiki-blanco/play.html` — the Tiki Snake card's `href="snake.html"` —
  to point at the existing game. Otherwise keep the bundled one.
- Open the PR.

## 4. Deploy (Cloudflare)

- If the site is **Cloudflare Pages connected to GitHub**: the PR gets an
  automatic **preview deployment URL** — smoke-test there (see §5), then
  merging to the production branch IS the deploy. Watch: Cloudflare
  dashboard → Workers & Pages → project → Deployments.
- If it's **direct upload**: `npx wrangler login` then
  `npx wrangler pages deploy . --project-name=<project>`.
- Stale content after deploy: zone → Caching → Purge Cache.
- Optional: `_headers` entry `/tiki-blanco/audio/*` →
  `Cache-Control: public, max-age=31536000` (the songs are 7.5 MB combined).

## 5. Smoke test (on the live/preview HTTPS URL — ES modules won't run from file://)

- [ ] `play.html`: both cards open their games (phone + desktop)
- [ ] Canyon: ENTER → music + intro swoop; walk (WASD), swim the river,
      DRIVE the Bronco (E), PADDLE the canoe
- [ ] Reload canyon → discoveries persist (localStorage `tikiblanco-save`)
- [ ] Snake: swipe steers on mobile; best score persists
- [ ] MP3s stream; no console errors

## 6. Gotchas & facts the next session should know

- **Brand spelling is "TikiBlänco" (a-umlaut)** everywhere in text/code.
  The poster image still shows the older "ã" — intentional until new art.
- The discovery jingle is an **original WebAudio homage** to the classic
  "secret found" sound, NOT Nintendo's audio file. Keep it that way.
- localStorage keys: `tikiblanco-save`, `tikiblanco-extras`,
  `tikiblanco-snake-best`.
- Debug handle for testing: `window.__tb` (player, cam, pois, found,
  vehicles, toggleDrive, fishPress, throwStick). Headless test pattern:
  serve folder, click `#enterBtn`, teleport via `__tb.player.pos`.
- Keyboard map: WASD walk, Shift run, Space hop, E drive, F fish,
  R fetch, P photo. Mobile has on-screen buttons for all.
- Folder ≈ 11 MB total; largest file is `audio/moontower.mp3` (5.7 MB) —
  well under Cloudflare Pages' 25 MB/file limit.
- All internal paths are relative → the folder works at any URL depth.

## 7. If anything's unclear

The dev history (5 commits, all messages descriptive) is on
`claude/tiki-blanco-interactive-game-bomjft` in frontend-projects.
`README.md` covers gameplay; `MIGRATION.md` is the condensed runbook.
