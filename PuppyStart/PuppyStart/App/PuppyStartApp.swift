import SwiftUI

@main
struct PuppyStartApp: App {
    @StateObject private var puppyStore = PuppyStore()
    @StateObject private var subscriptionManager = SubscriptionManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(puppyStore)
                .environmentObject(subscriptionManager)
        }
    }
}
