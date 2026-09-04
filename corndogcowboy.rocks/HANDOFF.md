# Handoff: move this folder into the private repo ToodlesMalone/corndogcowboy.rocks

This folder is the complete site. Nothing else in frontend-projects is needed.
Cloud sessions attached to frontend-projects cannot push to the private repo, so
the move happens from a session or terminal that has access to corndogcowboy.rocks.

## Option 1: fresh Claude Code session (web or desktop) opened on corndogcowboy.rocks

Paste this prompt:

> Pull the site from the public repo ToodlesMalone/frontend-projects, branch
> claude/corndogcowboy-landing-dWuI5, folder corndogcowboy.rocks/. Copy index.html,
> images/corndogcowboy.jpg and README.md into the root of this repo (leave HANDOFF.md
> behind), commit on main with the message "Corndog Cowboy landing page and game",
> and push.

## Option 2: terminal on the Mac

```bash
git clone --depth 1 -b claude/corndogcowboy-landing-dWuI5 \
  https://github.com/ToodlesMalone/frontend-projects.git cdc-src
mkdir corndogcowboy.rocks && cd corndogcowboy.rocks
cp -R ../cdc-src/corndogcowboy.rocks/{index.html,images,README.md} .
git init -b main && git add -A
git commit -m "Corndog Cowboy landing page and game"
git remote add origin https://github.com/ToodlesMalone/corndogcowboy.rocks.git
git push -u origin main
cd .. && rm -rf cdc-src
```

## Then, in Cloudflare

Workers & Pages > Create > Pages > Connect to Git > corndogcowboy.rocks.
Production branch `main`, framework preset None, build command empty, output directory `/`.
Custom domains: add corndogcowboy.rocks and www.corndogcowboy.rocks.
