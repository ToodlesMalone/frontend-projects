# F.R.I.D.A.Y. Brief — TikiBlänco Game Night

*Context card for Rodd's assistant. One page. Updated 2026-07-29.*

## What it is

Rodd commissioned a browser "game night" for the TikiBlänco website
(the Blanco, TX tiki bar — tikiblanco.com / tikiblanco.online). It's a
single static folder, `tiki-blanco/`, containing three pages:

1. **`play.html`** — game selector: Tiki Snake or Blood Moon Canyon.
2. **`index.html` — Blood Moon Canyon**: a 3D, N64-Zelda-style explorable
   version of the TikiBlänco blood-moon poster. 25 discoveries (3 secret),
   including: Wynonna and Winnie (Rodd's dogs, in-game — Wynonna follows
   you and plays fetch; Winnie sleeps in his own den), a drivable green
   Bronco (Rodd's truck) with a radio, a canoe, fishing, five collectible
   tiki mugs, a hidden tiki-bar grotto modeled on the real bar's interior,
   Rodd's tattoo carved into the canyon wall as a secret petroglyph,
   Bigfoot, the chupacabra, Bevo, a vineyard with a hidden wine glass that
   grants a speed boost, photo mode, a speedrun clock, and Rodd's two
   songs ("Moontower", "Roe v Wade") rotating as the soundtrack with
   spooky synth interludes. Progress saves in the browser.
3. **`snake.html`** — a tiki-themed snake game (stand-in; can be swapped
   for the site's existing snake by editing one link in play.html).

Brand spelling: **TikiBlänco** (a-umlaut) — the poster image still shows
the older "ã" until new art exists.

## Status (as of this brief)

- **Done & tested**: full game package complete; verified end-to-end in
  headless Chromium (all 25 discoveries, vehicles, fishing, mugs,
  completion) with zero console errors.
- **Lives at**: `ToodlesMalone/frontend-projects`, branch
  `claude/tiki-blanco-interactive-game-bomjft`, folder `tiki-blanco/`.
- **Pending**: migration into the private `ToodlesMalone/TikiBlanco.online`
  repo (the cloud session couldn't attach it). Rodd is doing this from a
  desktop Claude Code session on his Mac using `tiki-blanco/HANDOFF.md`
  and `tiki-blanco/MIGRATION.md` in the branch.
- **Deploy**: the site ships via Cloudflare (Pages). PR preview URL for
  testing → merge to production branch = live.

## Facts F.R.I.D.A.Y. may need

- Folder is ~11 MB, fully static, relative paths, no build step.
- Controls: WASD/joystick, Shift run, Space hop, E drive, F fish,
  R fetch, P photo; full touch support.
- Browser saves: `tikiblanco-save`, `tikiblanco-extras`,
  `tikiblanco-snake-best` (localStorage).
- The discovery jingle is an original synth homage, not Nintendo audio.
- Likely follow-ups Rodd mentioned or approved conceptually: linking from
  the site's Play nav; possibly swapping in the site's existing snake;
  future poster art with the ä spelling.
