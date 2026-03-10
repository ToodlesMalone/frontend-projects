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

## 5. TikiBlánco Game Theme Reference

| Element    | Style                         | Color (approx hex) |
|------------|-------------------------------|-------------------|
| Sky        | Warm sunset gradient          | `#FF8833` → `#FF6633` |
| Ground     | Sandy beach with pebbles      | `#F5E0A6` |
| Ocean stripe | Tropical turquoise          | `#17AECE` |
| Player     | White coconut with carved face | `#F5EDD8` |
| Obstacles  | Dark wood tiki totems         | `#8C4719` |
| UI text    | Gold & warm white             | `#FFE64D` / `#FFF7ED` |
| Font       | Georgia Bold (serif, tropical feel) | — |

---

## 6. Monetization Tips for TikiBlánco Runner

- **Rewarded ads** already wired: shows every 3 deaths, offers score continuation
- **Rewarded ad CPM** on casual iOS games: ~$4–$15 (much higher than banners)
- **Next step**: add a "Remove Ads" IAP for $1.99 — that alone often doubles revenue
- **Retention tip**: add a daily streak reward to keep users returning for ad inventory
