# PuppyStart 🐶

A complete iOS app for new puppy owners — built with SwiftUI, StoreKit 2, and the Anthropic Claude API.

## Features

### Free Tier
- **Onboarding** — Collect puppy name, breed, birthday, gender, and weight
- **Dashboard** — Hero card with puppy info, today's feeding/potty stats, and quick-log buttons
- **Milestone Tracker** — Week-by-week timeline from 8 weeks to 1 year with tips
- **Feeding Log** — Log meals with amount and notes; view history grouped by day
- **Potty Log** — Track successes and accidents with daily summary
- **Vaccination Scheduler** — Auto-generated schedule from puppy's birthday; mark as complete
- **Settings** — Profile view, data reset

### Premium ($4.99/month or $24.99/year)
- **AI Puppy Coach** — Powered by Claude `claude-opus-4-6` with adaptive thinking; real-time streaming responses; breed and age-aware system prompt
- **Training Programs** — Step-by-step programs: Sit & Stay, Crate Training, Loose Leash Walking, Recall, Advanced Tricks

---

## Architecture

```
PuppyStart/
├── App/
│   ├── PuppyStartApp.swift          # App entry point
│   └── RootView.swift               # Onboarding vs main tab router
├── Models/
│   └── Puppy.swift                  # All data models + milestone data
├── ViewModels/
│   ├── PuppyStore.swift             # Central state + UserDefaults persistence
│   └── AIChatViewModel.swift        # Chat state + Anthropic API calls
├── Services/
│   └── AnthropicService.swift       # URLSession SSE streaming to Anthropic API
├── Store/
│   └── SubscriptionManager.swift    # StoreKit 2 subscriptions
├── Views/
│   ├── Onboarding/                  # 4-page onboarding flow
│   ├── Dashboard/                   # Main tab, home, logs
│   ├── Milestones/                  # Timeline view
│   ├── Feeding/                     # Feeding log sheet
│   ├── Potty/                       # Potty log sheet
│   ├── Training/                    # Programs + lesson detail
│   ├── AIChat/                      # Chat UI + streaming bubbles
│   └── Settings/                   # Settings + paywall
└── Resources/
    ├── Info.plist
    └── Assets.xcassets/             # BrandOrange, BrandYellow, BrandBlue colors
```

---

## Setup

### 1. Open in Xcode
```
open PuppyStart.xcodeproj
```

### 2. Set your Anthropic API key

In Xcode: **Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables**

```
ANTHROPIC_API_KEY = sk-ant-...
```

> For production, store the key in your backend and proxy requests — never ship API keys in a client app.

### 3. Configure StoreKit products

In App Store Connect, create two subscription products:
- `com.puppystart.premium.monthly` — $4.99/month
- `com.puppystart.premium.yearly` — $24.99/year

For local testing, add a `StoreKit Configuration File` to your scheme.

### 4. Set bundle ID and signing

- Bundle ID: `com.puppystart.app` (or your own)
- Enable **In-App Purchase** capability
- Enable **StoreKit** capability

---

## Monetization Strategy

| Lever | Detail |
|---|---|
| Paywall trigger | Shown on AI Coach tab and after onboarding completes |
| Upsell card | Visible on dashboard whenever not subscribed |
| Premium gate | Training advanced programs locked with visual lock icon |
| Free value | Feeding/potty/vaccination logs are genuinely useful — builds habit |
| Conversion hook | AI chat is the killer feature; 5 suggested questions shown immediately |

**Recommended price:** $4.99/month / $24.99/year (58% savings on annual)

---

## AI Integration

- Model: `claude-opus-4-6` with `thinking: {type: "adaptive"}`
- Transport: Direct REST API via `URLSession` with SSE streaming
- System prompt: Personalized with puppy name, breed, age, and gender
- Context: Last 10 messages sent to keep costs controlled
- Suggested questions: 5 pre-written questions shown to new users to drive first engagement

---

## Requirements

- iOS 16.0+
- Xcode 15+
- Swift 5.9+
- Anthropic API key
- Apple Developer account (for StoreKit production)
