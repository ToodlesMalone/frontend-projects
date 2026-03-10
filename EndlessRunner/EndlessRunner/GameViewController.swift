import UIKit
import SpriteKit

class GameViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        // Initialize AdManager (loads first ad)
        AdManager.shared.initialize()

        // Observe game over to offer rewarded ad
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleGameOver(_:)),
            name: .gameDidEnd,
            object: nil
        )

        guard let skView = view as? SKView else { return }

        let scene = GameScene(size: view.bounds.size)
        scene.scaleMode = .resizeFill

        skView.presentScene(scene)
        skView.ignoresSiblingOrder = true

        // Debug helpers (disable for release)
        #if DEBUG
        skView.showsFPS = true
        skView.showsNodeCount = true
        #endif
    }

    @objc private func handleGameOver(_ notification: Notification) {
        let score = notification.userInfo?["score"] as? Int ?? 0

        // Offer rewarded ad every 3 deaths (don't spam the player)
        let deaths = UserDefaults.standard.integer(forKey: "totalDeaths") + 1
        UserDefaults.standard.set(deaths, forKey: "totalDeaths")

        if deaths % 3 == 0 {
            showRewardedAdPrompt(score: score)
        }
    }

    private func showRewardedAdPrompt(score: Int) {
        let alert = UIAlertController(
            title: "Continue?",
            message: "Watch a short ad to keep your score of \(score)!",
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "Watch Ad", style: .default) { [weak self] _ in
            guard let self = self else { return }
            AdManager.shared.showRewardedAd(from: self) { didEarn in
                if didEarn {
                    // TODO: Resume game with current score
                    print("Player earned reward — implement continue logic here")
                }
            }
        })

        alert.addAction(UIAlertAction(title: "No Thanks", style: .cancel))
        present(alert, animated: true)
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .landscape
    }

    override var prefersStatusBarHidden: Bool {
        return true
    }
}
