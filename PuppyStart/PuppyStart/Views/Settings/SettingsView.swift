import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @EnvironmentObject var subscriptionManager: SubscriptionManager
    @State private var showUpgradeSheet = false
    @State private var showResetAlert = false

    var body: some View {
        Form {
            // Puppy profile section
            if let puppy = puppyStore.puppy {
                Section("Puppy Profile") {
                    LabeledContent("Name", value: puppy.name)
                    LabeledContent("Breed", value: puppy.breed)
                    LabeledContent("Birthday", value: puppy.birthDate.formatted(date: .abbreviated, time: .omitted))
                    LabeledContent("Age", value: puppy.ageDescription)
                    LabeledContent("Gender", value: puppy.gender.rawValue)
                    if let weight = puppy.weightLbs {
                        LabeledContent("Weight", value: "\(String(format: "%.1f", weight)) lbs")
                    }
                }
            }

            // Subscription
            Section("Subscription") {
                if subscriptionManager.isPremium {
                    HStack {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundColor(.yellow)
                        Text("PuppyStart Premium")
                        Spacer()
                        Text("Active")
                            .foregroundColor(.green)
                            .font(.caption)
                    }
                } else {
                    Button(action: { showUpgradeSheet = true }) {
                        HStack {
                            Image(systemName: "star.fill")
                                .foregroundColor(.yellow)
                            Text("Upgrade to Premium")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    .foregroundColor(.primary)

                    Button("Restore Purchases") {
                        Task { await subscriptionManager.restorePurchases() }
                    }
                    .foregroundColor(Color("BrandOrange"))
                }
            }

            // App info
            Section("About") {
                LabeledContent("Version", value: "1.0.0")
                Link("Privacy Policy", destination: URL(string: "https://puppystart.app/privacy")!)
                Link("Terms of Use", destination: URL(string: "https://puppystart.app/terms")!)
                Link("Rate PuppyStart", destination: URL(string: "https://apps.apple.com")!)
            }

            // Danger zone
            Section {
                Button(role: .destructive) {
                    showResetAlert = true
                } label: {
                    Label("Reset All Data", systemImage: "trash")
                }
            }
        }
        .navigationTitle("Settings")
        .sheet(isPresented: $showUpgradeSheet) { PaywallView() }
        .alert("Reset All Data?", isPresented: $showResetAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Reset", role: .destructive) { resetApp() }
        } message: {
            Text("This will delete your puppy profile, all logs, and settings. This cannot be undone.")
        }
    }

    private func resetApp() {
        UserDefaults.standard.removePersistentDomain(forName: Bundle.main.bundleIdentifier ?? "")
        // Restart will show onboarding again
    }
}
