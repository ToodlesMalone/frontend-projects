import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @EnvironmentObject var subscriptionManager: SubscriptionManager
    @State private var showFeedingSheet = false
    @State private var showPottySheet = false
    @State private var showUpgradeSheet = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Hero card
                    PuppyHeroCard()

                    // Today's stats
                    TodayStatsRow()

                    // Quick action buttons
                    QuickActionsRow(
                        onFeed: { showFeedingSheet = true },
                        onPotty: { showPottySheet = true }
                    )

                    // Next milestone
                    if let next = puppyStore.nextMilestone {
                        NextMilestoneCard(milestone: next)
                    }

                    // Upcoming vaccinations
                    if !puppyStore.upcomingVaccinations.isEmpty {
                        UpcomingVaccinationsCard()
                    }

                    // Upsell card if not subscribed
                    if !subscriptionManager.isPremium {
                        PremiumUpsellCard(onTap: { showUpgradeSheet = true })
                    }

                    Spacer(minLength: 20)
                }
                .padding(.horizontal, 16)
            }
            .navigationTitle(puppyStore.puppy?.name ?? "PuppyStart")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape")
                            .foregroundColor(Color("BrandOrange"))
                    }
                }
            }
        }
        .sheet(isPresented: $showFeedingSheet) { FeedingLogSheet() }
        .sheet(isPresented: $showPottySheet) { PottyLogSheet() }
        .sheet(isPresented: $showUpgradeSheet) { PaywallView() }
    }
}

// MARK: - Subcomponents

struct PuppyHeroCard: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 20)
                .fill(LinearGradient(colors: [Color("BrandYellow"), Color("BrandOrange")],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))

            HStack(spacing: 16) {
                if let photoData = puppyStore.puppy?.photoData,
                   let uiImage = UIImage(data: photoData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 80, height: 80)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 3))
                } else {
                    ZStack {
                        Circle()
                            .fill(Color.white.opacity(0.3))
                            .frame(width: 80, height: 80)
                        Text("🐶").font(.system(size: 40))
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(puppyStore.puppy?.name ?? "Your Pup")
                        .font(.title2.bold())
                        .foregroundColor(.white)
                    Text(puppyStore.puppy?.ageDescription ?? "")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.85))
                    if let breed = puppyStore.puppy?.breed {
                        Text(breed)
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.75))
                    }
                }
                Spacer()
            }
            .padding(20)
        }
    }
}

struct TodayStatsRow: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        HStack(spacing: 12) {
            StatCard(icon: "fork.knife", value: "\(puppyStore.todayFeedingCount)", label: "Fed Today", color: .green)
            StatCard(icon: "drop.fill", value: "\(puppyStore.todayPottyCount)", label: "Potty Trips", color: .blue)
            StatCard(icon: "exclamationmark.triangle.fill",
                     value: "\(puppyStore.todayAccidentCount)",
                     label: "Accidents",
                     color: puppyStore.todayAccidentCount == 0 ? .green : .orange)
        }
    }
}

struct StatCard: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
            Text(value)
                .font(.title2.bold())
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }
}

struct QuickActionsRow: View {
    let onFeed: () -> Void
    let onPotty: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ActionButton(icon: "fork.knife.circle.fill", label: "Log Feeding", color: Color("BrandOrange"), action: onFeed)
            ActionButton(icon: "drop.circle.fill", label: "Log Potty", color: Color("BrandBlue"), action: onPotty)
        }
    }
}

struct ActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                Text(label)
                    .font(.headline)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(color)
            .cornerRadius(14)
        }
    }
}

struct NextMilestoneCard: View {
    let milestone: Milestone

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "flag.fill")
                    .foregroundColor(Color("BrandOrange"))
                Text("Next Milestone")
                    .font(.headline)
                Spacer()
                Text("Week \(milestone.weekNumber)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Text(milestone.title)
                .font(.subheadline.bold())
            Text(milestone.description)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }
}

struct UpcomingVaccinationsCard: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "syringe.fill")
                    .foregroundColor(.purple)
                Text("Upcoming Vaccines")
                    .font(.headline)
                Spacer()
            }
            ForEach(puppyStore.upcomingVaccinations.prefix(2)) { vax in
                HStack {
                    VStack(alignment: .leading) {
                        Text(vax.name).font(.subheadline)
                        Text(vax.scheduledDate, style: .date)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "calendar")
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }
}

struct PremiumUpsellCard: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                Text("✨")
                    .font(.system(size: 36))
                VStack(alignment: .leading, spacing: 4) {
                    Text("Unlock AI Puppy Coach")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("Get 24/7 personalized advice, expert training programs & more.")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.85))
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(16)
            .background(
                LinearGradient(colors: [Color.purple, Color.pink],
                               startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(16)
        }
    }
}
