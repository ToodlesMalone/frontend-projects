import SpriteKit
import GameplayKit

// MARK: - TikiBlánco Color Palette
private extension SKColor {
    /// Deep tropical ocean sky at sunset
    static let tikiBg      = SKColor(red: 0.99, green: 0.72, blue: 0.38, alpha: 1.0)  // warm amber horizon
    /// Sandy beach ground
    static let tikiSand    = SKColor(red: 0.96, green: 0.88, blue: 0.65, alpha: 1.0)
    /// Ocean water stripe below sand
    static let tikiOcean   = SKColor(red: 0.09, green: 0.60, blue: 0.78, alpha: 1.0)
    /// Tiki totem brown
    static let tikiTotem   = SKColor(red: 0.55, green: 0.28, blue: 0.10, alpha: 1.0)
    /// Coconut — creamy white with dark shell
    static let tikiCoconut = SKColor(red: 0.96, green: 0.93, blue: 0.85, alpha: 1.0)
    /// Gold UI text
    static let tikiBlancoGold  = SKColor(red: 1.00, green: 0.90, blue: 0.30, alpha: 1.0)
    /// White-sand UI text
    static let tikiBlancoWhite = SKColor(red: 1.00, green: 0.97, blue: 0.93, alpha: 1.0)
}

// MARK: - Physics Categories
struct PhysicsCategory {
    static let none:     UInt32 = 0
    static let player:   UInt32 = 0b001
    static let obstacle: UInt32 = 0b010
    static let ground:   UInt32 = 0b100
}

class GameScene: SKScene, SKPhysicsContactDelegate {

    // MARK: - Nodes
    private var playerNode: SKSpriteNode!
    private var groundNode: SKNode!
    private var scoreLabel: SKLabelNode!
    private var gameOverLabel: SKLabelNode!
    private var restartButton: SKLabelNode!

    // MARK: - State
    private var isGameRunning = false
    private var isPlayerOnGround = true
    private var score = 0
    private var scoreTimer: Timer?
    private var obstacleTimer: Timer?
    private var lastUpdateTime: TimeInterval = 0

    // MARK: - Constants
    private let groundHeight: CGFloat = 90
    private let playerSize = CGSize(width: 52, height: 52)
    private let groundScrollSpeed: CGFloat = 310
    private let jumpImpulse: CGFloat = 530

    // MARK: - Setup
    override func didMove(to view: SKView) {
        setupBackground()
        physicsWorld.gravity = CGVector(dx: 0, dy: -12)
        physicsWorld.contactDelegate = self

        setupGround()
        setupPlayer()
        setupHUD()
        showStartScreen()
    }

    // MARK: - TikiBlánco Background

    private func setupBackground() {
        // Layered sunset gradient via two rects
        let skyBottom = SKSpriteNode(color: SKColor(red: 1.0, green: 0.55, blue: 0.20, alpha: 1), size: CGSize(width: frame.width, height: frame.height * 0.5))
        skyBottom.anchorPoint = .zero
        skyBottom.position = CGPoint(x: 0, y: frame.height * 0.5)
        skyBottom.zPosition = -10
        addChild(skyBottom)

        let skyTop = SKSpriteNode(color: SKColor(red: 0.95, green: 0.40, blue: 0.20, alpha: 1), size: CGSize(width: frame.width, height: frame.height * 0.5))
        skyTop.anchorPoint = .zero
        skyTop.position = CGPoint(x: 0, y: frame.height)
        skyTop.zPosition = -10
        addChild(skyTop)

        backgroundColor = SKColor(red: 1.0, green: 0.65, blue: 0.25, alpha: 1)

        // Ocean stripe just above ground
        let ocean = SKSpriteNode(color: .tikiBlancoWhite, size: CGSize(width: frame.width, height: 18))
        // Actually use ocean color
        ocean.color = .tikiOcean
        ocean.anchorPoint = CGPoint(x: 0, y: 0)
        ocean.position = CGPoint(x: 0, y: groundHeight - 18)
        ocean.zPosition = -1
        addChild(ocean)

        // Distant palm silhouettes (decorative, non-scrolling)
        for i in 0..<4 {
            addPalmSilhouette(x: CGFloat(i) * frame.width / 3 + 60)
        }
    }

    private func addPalmSilhouette(x: CGFloat) {
        // Trunk
        let trunk = SKSpriteNode(color: SKColor(red: 0.25, green: 0.12, blue: 0.04, alpha: 0.5),
                                  size: CGSize(width: 8, height: CGFloat.random(in: 60...100)))
        trunk.anchorPoint = CGPoint(x: 0.5, y: 0)
        trunk.position = CGPoint(x: x, y: groundHeight)
        trunk.zPosition = -2
        addChild(trunk)

        // Frond cluster
        let frond = SKSpriteNode(color: SKColor(red: 0.12, green: 0.35, blue: 0.12, alpha: 0.45),
                                  size: CGSize(width: 44, height: 22))
        frond.position = CGPoint(x: x, y: groundHeight + trunk.size.height + 10)
        frond.zPosition = -2
        addChild(frond)
    }

    // MARK: - Ground

    private func setupGround() {
        groundNode = SKNode()
        addChild(groundNode)

        for i in 0..<3 {
            let tile = makeGroundTile(xOffset: CGFloat(i) * frame.width)
            groundNode.addChild(tile)
        }
    }

    private func makeGroundTile(xOffset: CGFloat) -> SKNode {
        let container = SKNode()
        container.position = CGPoint(x: xOffset, y: 0)
        container.name = "groundTile"

        // Sand top layer
        let sand = SKSpriteNode(color: .tikiSand, size: CGSize(width: frame.width, height: groundHeight))
        sand.anchorPoint = CGPoint(x: 0, y: 0)

        // Add small pebble dots for texture
        for _ in 0..<12 {
            let pebble = SKSpriteNode(color: SKColor(red: 0.78, green: 0.65, blue: 0.42, alpha: 0.8),
                                      size: CGSize(width: CGFloat.random(in: 3...7), height: CGFloat.random(in: 3...6)))
            pebble.position = CGPoint(x: CGFloat.random(in: 0...frame.width),
                                      y: CGFloat.random(in: 5...groundHeight - 10))
            sand.addChild(pebble)
        }

        container.addChild(sand)

        // Physics on the container
        let body = SKPhysicsBody(rectangleOf: CGSize(width: frame.width, height: groundHeight),
                                  center: CGPoint(x: frame.width / 2, y: groundHeight / 2))
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.ground
        body.contactTestBitMask = PhysicsCategory.player
        container.physicsBody = body

        return container
    }

    // MARK: - Player (Coconut character)

    private func setupPlayer() {
        // Outer shell
        playerNode = SKSpriteNode(color: .tikiBlancoWhite, size: playerSize)
        playerNode.position = CGPoint(x: 110, y: groundHeight + playerSize.height / 2)
        playerNode.name = "player"

        // Eyes (two dark dots)
        let eyeL = SKSpriteNode(color: SKColor(red: 0.2, green: 0.1, blue: 0.05, alpha: 1), size: CGSize(width: 7, height: 7))
        eyeL.position = CGPoint(x: -10, y: 10)
        playerNode.addChild(eyeL)

        let eyeR = SKSpriteNode(color: SKColor(red: 0.2, green: 0.1, blue: 0.05, alpha: 1), size: CGSize(width: 7, height: 7))
        eyeR.position = CGPoint(x: 10, y: 10)
        playerNode.addChild(eyeR)

        // Coconut husk lines
        let line = SKSpriteNode(color: SKColor(red: 0.65, green: 0.45, blue: 0.22, alpha: 0.6), size: CGSize(width: 40, height: 3))
        line.position = CGPoint(x: 0, y: 0)
        playerNode.addChild(line)

        playerNode.physicsBody = SKPhysicsBody(rectangleOf: playerSize)
        playerNode.physicsBody?.allowsRotation = false
        playerNode.physicsBody?.categoryBitMask = PhysicsCategory.player
        playerNode.physicsBody?.contactTestBitMask = PhysicsCategory.obstacle | PhysicsCategory.ground
        playerNode.physicsBody?.collisionBitMask = PhysicsCategory.ground | PhysicsCategory.obstacle

        addChild(playerNode)
    }

    // MARK: - HUD

    private func setupHUD() {
        // Score badge background
        let badge = SKSpriteNode(color: SKColor(red: 0, green: 0, blue: 0, alpha: 0.25), size: CGSize(width: 130, height: 46))
        badge.position = CGPoint(x: frame.midX, y: frame.maxY - 50)
        badge.zPosition = 9
        badge.cornerRadius = 12
        addChild(badge)

        scoreLabel = SKLabelNode(fontNamed: "Georgia-Bold")
        scoreLabel.fontSize = 30
        scoreLabel.fontColor = .tikiBlancoGold
        scoreLabel.verticalAlignmentMode = .center
        scoreLabel.position = CGPoint(x: frame.midX, y: frame.maxY - 50)
        scoreLabel.zPosition = 10
        scoreLabel.text = "🌴 0"
        addChild(scoreLabel)
    }

    // MARK: - Start Screen

    private func showStartScreen() {
        // Title
        let title = SKLabelNode(fontNamed: "Georgia-Bold")
        title.text = "TikiBlánco"
        title.fontSize = 54
        title.fontColor = .tikiBlancoWhite
        title.position = CGPoint(x: frame.midX, y: frame.midY + 60)
        title.name = "startLabel"
        title.zPosition = 10
        // Subtle shadow
        let shadow = SKLabelNode(fontNamed: "Georgia-Bold")
        shadow.text = "TikiBlánco"
        shadow.fontSize = 54
        shadow.fontColor = SKColor(red: 0.3, green: 0.1, blue: 0, alpha: 0.5)
        shadow.position = CGPoint(x: 2, y: -3)
        shadow.zPosition = -1
        title.addChild(shadow)
        addChild(title)

        let tapLabel = SKLabelNode(fontNamed: "Georgia")
        tapLabel.text = "Tap to Run!"
        tapLabel.fontSize = 32
        tapLabel.fontColor = .tikiBlancoGold
        tapLabel.position = CGPoint(x: frame.midX, y: frame.midY)
        tapLabel.name = "tapLabel"
        tapLabel.zPosition = 10
        // Pulse animation
        tapLabel.run(SKAction.repeatForever(SKAction.sequence([
            SKAction.fadeAlpha(to: 0.3, duration: 0.7),
            SKAction.fadeAlpha(to: 1.0, duration: 0.7)
        ])))
        addChild(tapLabel)
    }

    // MARK: - Start / Restart

    private func startGame() {
        isGameRunning = true
        score = 0
        scoreLabel.text = "🌴 0"

        childNode(withName: "startLabel")?.removeFromParent()
        childNode(withName: "tapLabel")?.removeFromParent()
        gameOverLabel?.removeFromParent()
        restartButton?.removeFromParent()
        enumerateChildNodes(withName: "obstacle") { node, _ in node.removeFromParent() }
        enumerateChildNodes(withName: "scorePopup") { node, _ in node.removeFromParent() }

        playerNode.physicsBody?.velocity = .zero
        playerNode.position = CGPoint(x: 110, y: groundHeight + playerSize.height / 2)
        isPlayerOnGround = true

        startTimers()
    }

    private func startTimers() {
        scoreTimer?.invalidate()
        obstacleTimer?.invalidate()

        scoreTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self, self.isGameRunning else { return }
            self.score += 1
            self.scoreLabel.text = "🌴 \(self.score)"
        }

        scheduleNextObstacle()
    }

    private func scheduleNextObstacle() {
        let delay = Double.random(in: 1.4...2.8)
        obstacleTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self, self.isGameRunning else { return }
            self.spawnObstacle()
            self.scheduleNextObstacle()
        }
    }

    // MARK: - Tiki Totem Obstacles

    private func spawnObstacle() {
        let height = CGFloat.random(in: 50...110)
        let totem = buildTikiTotem(height: height)
        totem.position = CGPoint(x: frame.maxX + 35, y: groundHeight)
        totem.name = "obstacle"
        addChild(totem)

        let duration = Double(frame.width + 80) / Double(groundScrollSpeed)
        totem.run(SKAction.sequence([
            SKAction.moveBy(x: -(frame.width + 80), y: 0, duration: duration),
            SKAction.removeFromParent()
        ]))
    }

    private func buildTikiTotem(height: CGFloat) -> SKNode {
        let container = SKNode()

        // Totem body
        let body = SKSpriteNode(color: .tikiBlancoWhite, size: CGSize(width: 32, height: height))
        body.color = .tikiTotem
        body.anchorPoint = CGPoint(x: 0.5, y: 0)

        // Carved face — eyes
        let eyeL = SKSpriteNode(color: .tikiBlancoGold, size: CGSize(width: 6, height: 5))
        eyeL.position = CGPoint(x: -6, y: height - 18)
        body.addChild(eyeL)

        let eyeR = SKSpriteNode(color: .tikiBlancoGold, size: CGSize(width: 6, height: 5))
        eyeR.position = CGPoint(x: 6, y: height - 18)
        body.addChild(eyeR)

        // Carved mouth
        let mouth = SKSpriteNode(color: .tikiBlancoGold, size: CGSize(width: 18, height: 4))
        mouth.position = CGPoint(x: 0, y: height - 30)
        body.addChild(mouth)

        // Headdress on top
        let crown = SKSpriteNode(color: SKColor(red: 0.70, green: 0.20, blue: 0.10, alpha: 1), size: CGSize(width: 44, height: 14))
        crown.anchorPoint = CGPoint(x: 0.5, y: 0)
        crown.position = CGPoint(x: 0, y: height)
        body.addChild(crown)

        container.addChild(body)

        // Physics body
        let phys = SKPhysicsBody(rectangleOf: CGSize(width: 32, height: height),
                                  center: CGPoint(x: 0, y: height / 2))
        phys.isDynamic = false
        phys.categoryBitMask = PhysicsCategory.obstacle
        phys.contactTestBitMask = PhysicsCategory.player
        phys.collisionBitMask = PhysicsCategory.player
        container.physicsBody = phys

        return container
    }

    // MARK: - Input

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        if !isGameRunning {
            startGame()
            return
        }

        if let touch = touches.first {
            let location = touch.location(in: self)
            if let restart = restartButton, restart.contains(location) {
                startGame()
                return
            }
        }

        jump()
    }

    private func jump() {
        guard isPlayerOnGround else { return }
        isPlayerOnGround = false
        playerNode.physicsBody?.applyImpulse(CGVector(dx: 0, dy: jumpImpulse))

        // Coconut bounce animation
        let squash  = SKAction.scaleX(to: 1.3, y: 0.75, duration: 0.05)
        let stretch = SKAction.scaleX(to: 0.85, y: 1.25, duration: 0.10)
        let restore = SKAction.scaleX(to: 1.0,  y: 1.0,  duration: 0.10)
        playerNode.run(SKAction.sequence([squash, stretch, restore]))

        // Small dust puff on jump
        spawnDustPuff(at: playerNode.position)
    }

    private func spawnDustPuff(at point: CGPoint) {
        for _ in 0..<5 {
            let dust = SKSpriteNode(color: SKColor(red: 0.96, green: 0.88, blue: 0.65, alpha: 0.7),
                                    size: CGSize(width: CGFloat.random(in: 4...10), height: CGFloat.random(in: 4...10)))
            dust.position = CGPoint(x: point.x + CGFloat.random(in: -14...14),
                                    y: point.y - playerSize.height / 2 + 4)
            dust.zPosition = 5
            addChild(dust)
            let drift = SKAction.group([
                SKAction.moveBy(x: CGFloat.random(in: -20...20), y: CGFloat.random(in: 5...20), duration: 0.4),
                SKAction.fadeOut(withDuration: 0.4),
                SKAction.scale(to: 0.1, duration: 0.4)
            ])
            dust.run(SKAction.sequence([drift, SKAction.removeFromParent()]))
        }
    }

    // MARK: - Collision Detection

    func didBegin(_ contact: SKPhysicsContact) {
        let maskA = contact.bodyA.categoryBitMask
        let maskB = contact.bodyB.categoryBitMask

        if (maskA == PhysicsCategory.player && maskB == PhysicsCategory.ground) ||
           (maskA == PhysicsCategory.ground  && maskB == PhysicsCategory.player) {
            isPlayerOnGround = true
            spawnDustPuff(at: playerNode.position)
        }

        if (maskA == PhysicsCategory.player   && maskB == PhysicsCategory.obstacle) ||
           (maskA == PhysicsCategory.obstacle && maskB == PhysicsCategory.player) {
            if isGameRunning { gameOver() }
        }
    }

    // MARK: - Game Over

    private func gameOver() {
        isGameRunning = false
        scoreTimer?.invalidate()
        obstacleTimer?.invalidate()

        playerNode.physicsBody?.velocity = .zero

        // Hit flash — orange-red for tiki fire
        let flash = SKAction.sequence([
            SKAction.colorize(with: SKColor(red: 0.9, green: 0.3, blue: 0.1, alpha: 1), colorBlendFactor: 0.8, duration: 0.08),
            SKAction.colorize(with: .tikiBlancoWhite, colorBlendFactor: 0, duration: 0.35)
        ])
        playerNode.run(flash)

        // Dark overlay
        let overlay = SKSpriteNode(color: SKColor(red: 0.1, green: 0.05, blue: 0, alpha: 0.55), size: frame.size)
        overlay.anchorPoint = .zero
        overlay.position = .zero
        overlay.zPosition = 9
        overlay.name = "overlay"
        addChild(overlay)

        gameOverLabel = SKLabelNode(fontNamed: "Georgia-Bold")
        gameOverLabel.text = "Wiped Out!"
        gameOverLabel.fontSize = 54
        gameOverLabel.fontColor = .tikiBlancoWhite
        gameOverLabel.position = CGPoint(x: frame.midX, y: frame.midY + 55)
        gameOverLabel.zPosition = 10
        addChild(gameOverLabel)

        let finalScore = SKLabelNode(fontNamed: "Georgia")
        finalScore.text = "🌴 Score: \(score)"
        finalScore.fontSize = 34
        finalScore.fontColor = .tikiBlancoGold
        finalScore.position = CGPoint(x: frame.midX, y: frame.midY + 5)
        finalScore.zPosition = 10
        addChild(finalScore)

        restartButton = SKLabelNode(fontNamed: "Georgia-Bold")
        restartButton.text = "  Run Again  "
        restartButton.fontSize = 28
        restartButton.fontColor = SKColor(red: 0.1, green: 0.05, blue: 0, alpha: 1)
        restartButton.position = CGPoint(x: frame.midX, y: frame.midY - 55)
        restartButton.zPosition = 11
        addChild(restartButton)

        // Gold button background
        let btnBg = SKSpriteNode(color: .tikiBlancoGold, size: CGSize(width: 180, height: 44))
        btnBg.position = CGPoint(x: 0, y: -2)
        btnBg.zPosition = -1
        btnBg.cornerRadius = 10
        restartButton.addChild(btnBg)

        // Slide-in animations
        gameOverLabel.position.y += 80
        gameOverLabel.run(SKAction.moveTo(y: frame.midY + 55, duration: 0.4))
        finalScore.alpha = 0
        finalScore.run(SKAction.sequence([SKAction.wait(forDuration: 0.25), SKAction.fadeIn(withDuration: 0.3)]))

        NotificationCenter.default.post(name: .gameDidEnd, object: nil, userInfo: ["score": score])
    }

    // MARK: - Update Loop

    override func update(_ currentTime: TimeInterval) {
        guard isGameRunning else { return }
        scrollGround()
    }

    private func scrollGround() {
        let delta = groundScrollSpeed / CGFloat(60)
        groundNode.enumerateChildNodes(withName: "groundTile") { node, _ in
            node.position.x -= delta
            if node.position.x <= -self.frame.width {
                node.position.x += self.frame.width * 3
            }
        }
    }
}

// MARK: - Notification Name
extension Notification.Name {
    static let gameDidEnd = Notification.Name("gameDidEnd")
}

// MARK: - SKSpriteNode rounded corners helper
private extension SKSpriteNode {
    var cornerRadius: CGFloat {
        get { return 0 }
        set {
            guard newValue > 0 else { return }
            let rect = CGRect(origin: CGPoint(x: -size.width/2, y: -size.height/2), size: size)
            let path = UIBezierPath(roundedRect: rect, cornerRadius: newValue)
            let shape = SKShapeNode(path: path.cgPath)
            shape.fillColor = color
            shape.strokeColor = .clear
            shape.lineWidth = 0
            color = .clear
            addChild(shape)
        }
    }
}
