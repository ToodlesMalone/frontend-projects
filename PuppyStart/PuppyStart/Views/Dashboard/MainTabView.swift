import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @EnvironmentObject var subscriptionManager: SubscriptionManager

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            MilestonesView()
                .tabItem { Label("Milestones", systemImage: "flag.fill") }

            LogsView()
                .tabItem { Label("Logs", systemImage: "list.bullet.clipboard.fill") }

            TrainingView()
                .tabItem { Label("Training", systemImage: "figure.walk") }

            AIChatView(puppyStore: puppyStore)
                .tabItem { Label("AI Coach", systemImage: "bubble.left.and.bubble.right.fill") }
        }
        .accentColor(Color("BrandOrange"))
    }
}
