# TikiBlánco Runner — iOS Setup Guide

A tropical endless runner built with Swift + SpriteKit, themed around TikiBlánco's tiki bar aesthetic.

---

## Project Structure

```
EndlessRunner/
├── EndlessRunner/
│   ├── GameScene.swift          ← All game logic, TikiBlánco theme
│   ├── GameViewController.swift ← Presents game, handles ad prompts
│   └── AdManager.swift          ← AdMob rewarded ad wrapper (stubbed)
└── SETUP.md
```

---

## 1. Create the Xcode Project

1. Open Xcode → **File → New → Project**
2. Choose **iOS → Game**
3. Set:
   - Product Name: `TikiBlancoRunner`
   - Language: **Swift**
   - Game Technology: **SpriteKit**
4. Copy the three `.swift` files from this repo into your project, replacing the defaults.
5. In `Main.storyboard`, make sure the root view controller's **Custom Class** is `GameViewController`.
6. Set the `SKView` outlet in `GameViewController` if needed (the storyboard default usually handles this).

---

## 2. Add AdMob (Google Mobile Ads SDK)

### Via Swift Package Manager (recommended):
1. Xcode → **File → Add Package Dependencies**
2. URL: `https://github.com/googleads/swift-package-manager-google-mobile-ads`
3. Add **GoogleMobileAds** to your target.

### Info.plist entries required:
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>

<key>SKAdNetworkItems</key>
<array>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cstr6suwn9.skadnetwork</string>
  </dict>
</array>
```

### Activate AdMob in code:
In `AdManager.swift`, uncomment all lines marked `// REAL:` and remove the stub timer.

---

## 3. Apple Developer Account

- **Required**: $99/year at [developer.apple.com](https://developer.apple.com)
- Set your **Team** in Xcode → Target → Signing & Capabilities
- Enable **In-App Purchases** capability if you add IAP later

---

## 4. App Store Submission Checklist

- [ ] App icon (1024×1024 PNG, no alpha)
- [ ] Screenshots for iPhone 6.5" and iPad 12.9"
- [ ] Privacy policy URL (required because of AdMob)
- [ ] Set `NSUserTrackingUsageDescription` in Info.plist for ATT prompt
- [ ] Test with real AdMob test IDs before going live
- [ ] Archive → Validate → Submit in Xcode Organizer

---

## 5. TikiBlánco Brand Identity (tikiblanco.com)

TikiBlánco is located in Blanco, Texas — Texas Hill Country badlands.
"Where mysterious spirits of the tiki collide with the Texas Hill Country —
a place of dark skies, blood moons, and cold drinks under the stars
or in the comfort of a retired pirate's lair."

Creatures of the night: rattlesnakes, armadillos, bats, ravens.

| Element      | Style                                    | Color (approx hex)  |
|--------------|------------------------------------------|---------------------|
| Background   | Near-black night sky                     | `#0A0505`           |
| Sky glow     | Deep crimson dark                        | `#6B0A0A`           |
| Blood moon   | Orange-red moon with dark mare patches   | `#CC2E08`           |
| Ground       | Rocky badlands dirt, dark brown          | `#381608`           |
| Player       | Armadillo — armored shell, amber eye     | `#735A38`           |
| Obstacles    | Stone tiki idol (glowing amber eyes) + rock clusters | `#615248` |
| Dead trees   | Gnarled silhouettes in background        | `#1F1208` (70% alpha) |
| Stars        | Dim warm stars, constellations           | `#E6D9A6`           |
| UI text      | Bright amber gold                        | `#F2BF40`           |
| UI border    | Bamboo brown frame                       | `#8C6114`           |
| Font         | Georgia Bold/Italic (old-world tavern serif) | —              |
| Game over    | "THE SPIRITS CLAIM YOU"                  | blood moon red      |
| Tagline      | "...if you dare..."                      | italic, pulsing     |

---

## 6. Monetization Tips for TikiBlánco Runner

- **Rewarded ads** already wired: shows every 3 deaths, offers score continuation
- **Rewarded ad CPM** on casual iOS games: ~$4–$15 (much higher than banners)
- **Next step**: add a "Remove Ads" IAP for $1.99 — that alone often doubles revenue
- **Retention tip**: add a daily streak reward to keep users returning for ad inventory
