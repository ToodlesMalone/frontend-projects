import SwiftUI

struct RootView: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        if puppyStore.puppy == nil {
            OnboardingFlowView()
        } else {
            MainTabView()
        }
    }
}
