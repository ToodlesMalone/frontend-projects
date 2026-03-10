import UIKit

/// AdManager wraps Google Mobile Ads (AdMob).
///
/// Setup:
/// 1. Add the GoogleMobileAds SDK via Swift Package Manager:
///    https://github.com/googleads/swift-package-manager-google-mobile-ads
/// 2. Add your AdMob App ID to Info.plist under key: GADApplicationIdentifier
/// 3. Replace the placeholder ad unit IDs below with your real ones from AdMob dashboard.
/// 4. Uncomment the import and real implementation lines marked with "// REAL:"

// REAL: import GoogleMobileAds

class AdManager: NSObject {

    static let shared = AdManager()
    private override init() {}

    // Replace with your AdMob rewarded ad unit ID
    // Test ID: ca-app-pub-3940256099942544/1712485313
    // Production: ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
    private let rewardedAdUnitID = "ca-app-pub-3940256099942544/1712485313"

    // REAL: private var rewardedAd: GADRewardedAd?
    private var rewardCompletion: ((Bool) -> Void)?

    // MARK: - Lifecycle

    func initialize() {
        // REAL: GADMobileAds.sharedInstance().start { status in
        //     print("AdMob initialized: \(status)")
        // }
        loadRewardedAd()
    }

    // MARK: - Rewarded Ads

    private func loadRewardedAd() {
        // REAL:
        // let request = GADRequest()
        // GADRewardedAd.load(withAdUnitID: rewardedAdUnitID, request: request) { [weak self] ad, error in
        //     if let error = error {
        //         print("Rewarded ad failed to load: \(error)")
        //         return
        //     }
        //     self?.rewardedAd = ad
        //     self?.rewardedAd?.fullScreenContentDelegate = self
        // }
        print("[AdManager] Rewarded ad load called (stub)")
    }

    func showRewardedAd(from viewController: UIViewController, completion: @escaping (Bool) -> Void) {
        rewardCompletion = completion

        // REAL:
        // guard let rewardedAd = rewardedAd else {
        //     print("Rewarded ad not ready")
        //     completion(false)
        //     return
        // }
        // rewardedAd.present(fromRootViewController: viewController) {
        //     let reward = rewardedAd.adReward
        //     print("Reward earned: \(reward.amount) \(reward.type)")
        //     completion(true)
        // }

        // Stub: simulate earning reward after 2s
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            print("[AdManager] Stub: reward earned")
            completion(true)
            self.loadRewardedAd() // preload next
        }
    }
}

// REAL: extension AdManager: GADFullScreenContentDelegate {
//     func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
//         print("Ad failed to present: \(error)")
//         rewardCompletion?(false)
//         loadRewardedAd()
//     }
//     func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
//         loadRewardedAd()
//     }
// }
