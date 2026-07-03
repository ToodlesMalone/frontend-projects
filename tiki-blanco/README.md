# TikiBlãnco — Blood Moon Canyon

An interactive, explorable 3D version of the TikiBlãnco poster (Blanco, Texas),
in the spirit of N64-era Zelda with a dash of Minecraft. You wander the canyon
as a little tiki man and track down all 10 things from the artwork.

## Play

Open `index.html` in a browser (or serve the folder with any static server).
Everything is self-contained — no CDN, no build step. Three.js is vendored
locally in `js/three.module.min.js` (r160, MIT license).

## Controls

| Input | Desktop | Mobile |
|---|---|---|
| Walk | WASD / arrow keys | left-side virtual joystick |
| Look | click + drag | drag right side of screen |
| Jump | Space | JUMP button |

## The 10 discoveries

Everything from the poster: the Great Tiki, the blood moon & night sky
(stand on the stargazer's rock), Orion, a spiral galaxy, shooting stars,
bats, the Blanco River (wade in!), the dead oak, the raven, the armadillo,
the opossum, the rattlesnake (it rattles when you get close), the century
plant, and the prickly pear. Find all 10 and the Great Tiki's eyes light up.

Sound is synthesized live with WebAudio — crickets, wind, raven caws, and
the rattlesnake's warning. Toggle with the speaker button.

## Embedding on the website

The page is fully standalone: copy the `tiki-blanco/` folder anywhere and
link to `tiki-blanco/index.html`, or drop it in an `<iframe>`.
