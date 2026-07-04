# TikiBlãnco — Blood Moon Canyon

An interactive, explorable 3D world built from the TikiBlãnco poster (Blanco,
Texas), in the spirit of N64-era Zelda with a dash of Minecraft. You wander
the canyon as a little tiki man, drive a green Bronco, and track down all
**22 discoveries** — including a few secrets.

## Play

Open `index.html` in a browser (or serve the folder with any static server).
Everything is self-contained — no CDN, no build step. Three.js is vendored
locally in `js/three.module.min.js` (r160, MIT license).

## Controls

| Input | Desktop | Mobile |
|---|---|---|
| Walk | WASD / arrow keys | left-side virtual joystick |
| Run | hold Shift | push joystick to the edge |
| Look | click + drag | drag right side of screen |
| Jump | Space | JUMP button |
| Drive / exit Bronco | E (or on-screen button) | DRIVE button |

## The world

Everything from the poster: the Great Tiki, the blood moon, Orion, a spiral
galaxy, shooting stars, bats (they erupt from the dead oak), the Blanco
River (with its own sign), the raven, armadillo, opossum, rattlesnake,
century plant, and prickly pear — plus canyon flora (junipers, ocotillo,
cairns), a natural rock arch, fireflies, footstep dust, wading ripples,
drifting clouds that cross the moon, and a crackling campfire.

Creative-license additions: **Trader Blanco's Grotto** (a tiki bar carved
into the canyon wall — glowing mugs, rum barrel, blowfish lamp),
**Wynonna** (a curly little expedition dog who follows you once found),
**Winnie's Den** (the gentle giant asleep in his cave), a **drivable green
Bronco** with the retro stripe, Hill Country lore roaming the dark —
raccoon, gray fox, **Bevo**, **Bigfoot**, the **Chupacabra** — and two
secrets with no map markers: the Watcher on the east rim, and an old
carving at the canyon's end (swim past the arch).

Discoveries play an original WebAudio homage to the classic "secret found"
jingle. The field guide (tap the counter) shows riddle hints for anything
you haven't found, and a compass tracker points to the nearest find.
Progress saves to localStorage; "Reset Journey" starts over.

## Soundtrack

Two tracks in `audio/` rotate in the background, with synthesized spooky
canyon interludes (drone, coyote howl, wind, a distant raven) between
songs. Ambient crickets, wind, owl hoots, river lapping, campfire crackle,
grotto marimba, engine hum, and the rattlesnake's warning are all
synthesized live with WebAudio. Toggle everything with the speaker button.

## Embedding on the website

The page is fully standalone: copy the `tiki-blanco/` folder anywhere and
link to `tiki-blanco/index.html`, or drop it in an `<iframe>`.
