import SpriteKit
import GameplayKit

// MARK: - TikiBlánco Color Palette
// Blanco, Texas — where tiki spirits meet the badlands.
// Dark skies, blood moons, stone tiki idols, creatures of the night.
private extension SKColor {
    static let tbBlack      = SKColor(red: 0.04, green: 0.02, blue: 0.02, alpha: 1.0)  // near black
    static let tbDeepRed    = SKColor(red: 0.42, green: 0.04, blue: 0.04, alpha: 1.0)  // dark crimson bg glow
    static let tbBloodMoon  = SKColor(red: 0.80, green: 0.18, blue: 0.05, alpha: 1.0)  // blood moon orange-red
    static let tbGold       = SKColor(red: 0.78, green: 0.55, blue: 0.10, alpha: 1.0)  // amber gold (logo text)
    static let tbGoldBright = SKColor(red: 0.95, green: 0.75, blue: 0.25, alpha: 1.0)  // bright gold UI
    static let tbBamboo     = SKColor(red: 0.55, green: 0.38, blue: 0.08, alpha: 1.0)  // bamboo brown
    static let tbStone      = SKColor(red: 0.38, green: 0.32, blue: 0.26, alpha: 1.0)  // stone tiki
    static let tbDirt       = SKColor(red: 0.22, green: 0.14, blue: 0.08, alpha: 1.0)  // badlands ground
    static let tbDirtLight  = SKColor(red: 0.35, green: 0.22, blue: 0.12, alpha: 1.0)  // lighter ground
    static let tbRust       = SKColor(red: 0.50, green: 0.18, blue: 0.05, alpha: 1.0)  // horizon rust
    static let tbStar       = SKColor(red: 0.90, green: 0.85, blue: 0.65, alpha: 1.0)  // dim star
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
    private var bloodMoonNode: SKShapeNode!

    // MARK: - State
    private var isGameRunning = false
    private var isPlayerOnGround = true
    private var score = 0
    private var scoreTimer: Timer?
    private var obstacleTimer: Timer?

    // MARK: - Constants
    private let groundHeight: CGFloat = 70
    private let playerSize   = CGSize(width: 46, height: 46)
    private let groundScrollSpeed: CGFloat = 300
    private let jumpImpulse: CGFloat = 520

    // MARK: - Setup

    override func didMove(to view: SKView) {
        backgroundColor = .tbBlack
        physicsWorld.gravity = CGVector(dx: 0, dy: -12)
        physicsWorld.contactDelegate = self

        setupNightSky()
        setupBloodMoon()
        setupHorizonGlow()
        setupDeadTreeSilhouettes()
        setupGround()
        setupPlayer()
        setupHUD()
        showStartScreen()
    }

    // MARK: - TikiBlánco Night Sky Environment

    private func setupNightSky() {
        // Deep dark crimson gradient sky — two rects
        let skyLow = SKSpriteNode(color: .tbDeepRed, size: CGSize(width: frame.width, height: frame.height * 0.45))
        skyLow.anchorPoint = .zero
        skyLow.position = CGPoint(x: 0, y: groundHeight)
        skyLow.zPosition = -20
        addChild(skyLow)

        let skyHigh = SKSpriteNode(color: .tbBlack, size: CGSize(width: frame.width, height: frame.height * 0.6))
        skyHigh.anchorPoint = .zero
        skyHigh.position = CGPoint(x: 0, y: frame.height * 0.45)
        skyHigh.zPosition = -20
        addChild(skyHigh)

        // Stars
        for _ in 0..<80 {
            let size = CGFloat.random(in: 1.2...3.5)
            let star = SKSpriteNode(color: .tbStar, size: CGSize(width: size, height: size))
            star.position = CGPoint(
                x: CGFloat.random(in: 0...frame.width),
                y: CGFloat.random(in: frame.height * 0.35...frame.maxY)
            )
            star.alpha = CGFloat.random(in: 0.3...0.9)
            star.zPosition = -15

            // Subtle twinkle on a few stars
            if Bool.random() {
                let twinkle = SKAction.repeatForever(SKAction.sequence([
                    SKAction.fadeAlpha(to: CGFloat.random(in: 0.1...0.3), duration: Double.random(in: 1.0...3.0)),
                    SKAction.fadeAlpha(to: CGFloat.random(in: 0.7...1.0), duration: Double.random(in: 1.0...3.0))
                ]))
                star.run(twinkle)
            }
            addChild(star)
        }

        // Constellation lines (hint of Scorpio — Texas skies)
        drawConstellation(points: [
            CGPoint(x: frame.width * 0.12, y: frame.height * 0.82),
            CGPoint(x: frame.width * 0.16, y: frame.height * 0.79),
            CGPoint(x: frame.width * 0.20, y: frame.height * 0.83),
            CGPoint(x: frame.width * 0.24, y: frame.height * 0.80)
        ])
    }

    private func drawConstellation(points: [CGPoint]) {
        guard points.count > 1 else { return }
        let path = CGMutablePath()
        path.move(to: points[0])
        for pt in points.dropFirst() { path.addLine(to: pt) }
        let line = SKShapeNode(path: path)
        line.strokeColor = SKColor(red: 0.9, green: 0.85, blue: 0.6, alpha: 0.18)
        line.lineWidth = 0.8
        line.zPosition = -14
        addChild(line)

        for pt in points {
            let dot = SKShapeNode(circleOfRadius: 1.5)
            dot.fillColor = .tbStar
            dot.strokeColor = .clear
            dot.position = pt
            dot.alpha = 0.6
            dot.zPosition = -13
            addChild(dot)
        }
    }

    private func setupBloodMoon() {
        // Outer glow
        let glow = SKShapeNode(circleOfRadius: 56)
        glow.fillColor = SKColor(red: 0.75, green: 0.12, blue: 0.02, alpha: 0.18)
        glow.strokeColor = .clear
        glow.position = CGPoint(x: frame.width * 0.78, y: frame.height * 0.72)
        glow.zPosition = -12
        addChild(glow)

        // Moon body
        bloodMoonNode = SKShapeNode(circleOfRadius: 38)
        bloodMoonNode.fillColor = .tbBloodMoon
        bloodMoonNode.strokeColor = SKColor(red: 0.9, green: 0.4, blue: 0.1, alpha: 0.4)
        bloodMoonNode.lineWidth = 3
        bloodMoonNode.position = CGPoint(x: frame.width * 0.78, y: frame.height * 0.72)
        bloodMoonNode.zPosition = -11

        // Dark mare patches on moon
        for _ in 0..<5 {
            let mare = SKShapeNode(circleOfRadius: CGFloat.random(in: 5...12))
            mare.fillColor = SKColor(red: 0.55, green: 0.08, blue: 0.02, alpha: 0.55)
            mare.strokeColor = .clear
            mare.position = CGPoint(x: CGFloat.random(in: -20...20), y: CGFloat.random(in: -20...20))
            bloodMoonNode.addChild(mare)
        }
        addChild(bloodMoonNode)

        // Slow pulse on glow
        let pulse = SKAction.repeatForever(SKAction.sequence([
            SKAction.fadeAlpha(to: 0.08, duration: 2.5),
            SKAction.fadeAlpha(to: 0.28, duration: 2.5)
        ]))
        glow.run(pulse)
    }

    private func setupHorizonGlow() {
        // Red-rust horizon glow strip
        let glow = SKSpriteNode(color: .tbRust, size: CGSize(width: frame.width, height: 30))
        glow.anchorPoint = CGPoint(x: 0, y: 0.5)
        glow.position = CGPoint(x: 0, y: groundHeight + 5)
        glow.alpha = 0.35
        glow.zPosition = -8
        addChild(glow)
    }

    private func setupDeadTreeSilhouettes() {
        // Gnarled dead trees in the background — signature TikiBlánco look
        let treePositions: [CGFloat] = [
            frame.width * 0.08,
            frame.width * 0.35,
            frame.width * 0.62,
            frame.width * 0.88
        ]
        for x in treePositions {
            addDeadTree(at: x, height: CGFloat.random(in: 80...130))
        }
    }

    private func addDeadTree(at x: CGFloat, height: CGFloat) {
        let color = SKColor(red: 0.12, green: 0.07, blue: 0.04, alpha: 0.70)

        // Trunk
        let trunk = SKSpriteNode(color: color, size: CGSize(width: 6, height: height))
        trunk.anchorPoint = CGPoint(x: 0.5, y: 0)
        trunk.position = CGPoint(x: x, y: groundHeight)
        trunk.zPosition = -5
        addChild(trunk)

        // Gnarled branches
        let branchAngles: [CGFloat] = [-55, -30, 30, 50]
        for angle in branchAngles {
            let branchLen = CGFloat.random(in: 25...55)
            let branch = SKSpriteNode(color: color, size: CGSize(width: 4, height: branchLen))
            branch.anchorPoint = CGPoint(x: 0.5, y: 0)
            branch.position = CGPoint(x: x + CGFloat.random(in: -8...8),
                                       y: groundHeight + height * CGFloat.random(in: 0.4...0.85))
            branch.zRotation = angle * .pi / 180
            branch.zPosition = -5
            addChild(branch)
        }
    }

    // MARK: - Ground (Badlands Rocky Terrain)

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

        // Main dirt/rock ground
        let base = SKSpriteNode(color: .tbDirt, size: CGSize(width: frame.width, height: groundHeight))
        base.anchorPoint = CGPoint(x: 0, y: 0)
        container.addChild(base)

        // Rock surface texture strip
        let surface = SKSpriteNode(color: .tbDirtLight, size: CGSize(width: frame.width, height: 10))
        surface.anchorPoint = CGPoint(x: 0, y: 0)
        surface.position = CGPoint(x: 0, y: groundHeight - 10)
        container.addChild(surface)

        // Random rocks scattered on surface
        for _ in 0..<10 {
            let w = CGFloat.random(in: 5...16)
            let h = CGFloat.random(in: 4...9)
            let rock = SKSpriteNode(color: .tbStone, size: CGSize(width: w, height: h))
            rock.position = CGPoint(x: CGFloat.random(in: 0...frame.width),
                                     y: groundHeight - 5)
            rock.zPosition = 1
            container.addChild(rock)
        }

        let body = SKPhysicsBody(
            rectangleOf: CGSize(width: frame.width, height: groundHeight),
            center: CGPoint(x: frame.width / 2, y: groundHeight / 2)
        )
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.ground
        body.contactTestBitMask = PhysicsCategory.player
        container.physicsBody = body

        return container
    }

    // MARK: - Player (Armadillo — "Creatures of the night are our neighbors here")

    private func setupPlayer() {
        // Body — armored shell oval
        playerNode = SKSpriteNode(color: SKColor(red: 0.45, green: 0.35, blue: 0.22, alpha: 1), size: playerSize)
        playerNode.position = CGPoint(x: 110, y: groundHeight + playerSize.height / 2)
        playerNode.name = "player"

        // Shell plate bands
        for i in 0..<3 {
            let band = SKSpriteNode(color: SKColor(red: 0.30, green: 0.22, blue: 0.12, alpha: 0.8),
                                     size: CGSize(width: 42, height: 5))
            band.position = CGPoint(x: 0, y: CGFloat(i - 1) * 11)
            playerNode.addChild(band)
        }

        // Snout
        let snout = SKSpriteNode(color: SKColor(red: 0.55, green: 0.42, blue: 0.28, alpha: 1),
                                  size: CGSize(width: 14, height: 10))
        snout.position = CGPoint(x: 24, y: -6)
        playerNode.addChild(snout)

        // Tiny eye
        let eye = SKSpriteNode(color: SKColor(red: 0.90, green: 0.75, blue: 0.20, alpha: 1),
                                size: CGSize(width: 5, height: 5))
        eye.position = CGPoint(x: 18, y: 8)
        playerNode.addChild(eye)

        playerNode.physicsBody = SKPhysicsBody(rectangleOf: playerSize)
        playerNode.physicsBody?.allowsRotation = false
        playerNode.physicsBody?.categoryBitMask = PhysicsCategory.player
        playerNode.physicsBody?.contactTestBitMask = PhysicsCategory.obstacle | PhysicsCategory.ground
        playerNode.physicsBody?.collisionBitMask = PhysicsCategory.ground | PhysicsCategory.obstacle

        addChild(playerNode)
    }

    // MARK: - HUD

    private func setupHUD() {
        // Skull icon + score — bamboo frame style
        let badge = SKSpriteNode(color: SKColor(red: 0.10, green: 0.06, blue: 0.03, alpha: 0.80),
                                  size: CGSize(width: 150, height: 44))
        badge.position = CGPoint(x: frame.midX, y: frame.maxY - 50)
        badge.zPosition = 9
        addChild(badge)

        // Bamboo border on badge
        let border = SKShapeNode(rectOf: CGSize(width: 150, height: 44), cornerRadius: 4)
        border.strokeColor = .tbBamboo
        border.fillColor = .clear
        border.lineWidth = 2
        border.position = CGPoint(x: frame.midX, y: frame.maxY - 50)
        border.zPosition = 10
        addChild(border)

        scoreLabel = SKLabelNode(fontNamed: "Georgia-Bold")
        scoreLabel.fontSize = 26
        scoreLabel.fontColor = .tbGoldBright
        scoreLabel.verticalAlignmentMode = .center
        scoreLabel.position = CGPoint(x: frame.midX, y: frame.maxY - 50)
        scoreLabel.zPosition = 11
        scoreLabel.text = "☠️  0"
        addChild(scoreLabel)
    }

    // MARK: - Start Screen

    private func showStartScreen() {
        // Dark overlay panel — styled like TikiBlánco bamboo sign
        let panel = SKSpriteNode(color: SKColor(red: 0.08, green: 0.04, blue: 0.02, alpha: 0.88),
                                  size: CGSize(width: 320, height: 200))
        panel.position = CGPoint(x: frame.midX, y: frame.midY + 10)
        panel.zPosition = 10
        panel.name = "startLabel"
        addChild(panel)

        // Bamboo border
        let border = SKShapeNode(rectOf: CGSize(width: 320, height: 200), cornerRadius: 6)
        border.strokeColor = .tbBamboo
        border.fillColor = .clear
        border.lineWidth = 4
        border.position = CGPoint(x: frame.midX, y: frame.midY + 10)
        border.zPosition = 11
        border.name = "startBorder"
        addChild(border)

        let title = SKLabelNode(fontNamed: "Georgia-Bold")
        title.text = "TIKI BLÁNCO"
        title.fontSize = 38
        title.fontColor = .tbGoldBright
        title.position = CGPoint(x: frame.midX, y: frame.midY + 50)
        title.zPosition = 12
        title.name = "startTitle"
        addChild(title)

        let subtitle = SKLabelNode(fontNamed: "Georgia-Italic")
        subtitle.text = "Blanco, Texas"
        subtitle.fontSize = 18
        subtitle.fontColor = .tbGold
        subtitle.position = CGPoint(x: frame.midX, y: frame.midY + 22)
        subtitle.zPosition = 12
        subtitle.name = "startSubtitle"
        addChild(subtitle)

        let tap = SKLabelNode(fontNamed: "Georgia-Italic")
        tap.text = "...tap to run, if you dare..."
        tap.fontSize = 20
        tap.fontColor = .tbBloodMoon
        tap.position = CGPoint(x: frame.midX, y: frame.midY - 20)
        tap.zPosition = 12
        tap.name = "startTap"
        tap.run(SKAction.repeatForever(SKAction.sequence([
            SKAction.fadeAlpha(to: 0.2, duration: 1.0),
            SKAction.fadeAlpha(to: 1.0, duration: 1.0)
        ])))
        addChild(tap)
    }

    private func removeStartScreen() {
        for name in ["startLabel", "startBorder", "startTitle", "startSubtitle", "startTap"] {
            childNode(withName: name)?.removeFromParent()
        }
    }

    // MARK: - Start / Restart

    private func startGame() {
        isGameRunning = true
        score = 0
        scoreLabel.text = "☠️  0"

        removeStartScreen()
        gameOverLabel?.removeFromParent()
        restartButton?.removeFromParent()
        childNode(withName: "gameOverBg")?.removeFromParent()
        childNode(withName: "finalScore")?.removeFromParent()
        childNode(withName: "gameOverBorder")?.removeFromParent()
        enumerateChildNodes(withName: "obstacle") { node, _ in node.removeFromParent() }
        enumerateChildNodes(withName: "dustPuff") { node, _ in node.removeFromParent() }

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
            self.scoreLabel.text = "☠️  \(self.score)"
        }

        scheduleNextObstacle()
    }

    private func scheduleNextObstacle() {
        let delay = Double.random(in: 1.3...2.8)
        obstacleTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self, self.isGameRunning else { return }
            self.spawnObstacle()
            self.scheduleNextObstacle()
        }
    }

    // MARK: - Obstacles (Stone Tiki Idols + Rattlesnake rocks)

    private func spawnObstacle() {
        // Alternate between tiki idol and rock cluster
        if Bool.random() {
            spawnTikiIdol()
        } else {
            spawnRockCluster()
        }
    }

    private func spawnTikiIdol() {
        let height = CGFloat.random(in: 55...105)
        let idol = buildTikiIdol(height: height)
        idol.position = CGPoint(x: frame.maxX + 40, y: groundHeight)
        idol.name = "obstacle"
        addChild(idol)

        let duration = Double(frame.width + 80) / Double(groundScrollSpeed)
        idol.run(SKAction.sequence([
            SKAction.moveBy(x: -(frame.width + 80), y: 0, duration: duration),
            SKAction.removeFromParent()
        ]))
    }

    private func buildTikiIdol(height: CGFloat) -> SKNode {
        let container = SKNode()

        // Stone body
        let body = SKSpriteNode(color: .tbStone, size: CGSize(width: 34, height: height))
        body.anchorPoint = CGPoint(x: 0.5, y: 0)

        // Carved angry brow ridge
        let brow = SKSpriteNode(color: SKColor(red: 0.25, green: 0.20, blue: 0.15, alpha: 1),
                                  size: CGSize(width: 28, height: 8))
        brow.position = CGPoint(x: 0, y: height - 16)
        body.addChild(brow)

        // Hollow eyes — glowing amber (tiki torch lit)
        for xOff: CGFloat in [-8, 8] {
            let eye = SKSpriteNode(color: .tbGoldBright, size: CGSize(width: 7, height: 6))
            eye.position = CGPoint(x: xOff, y: height - 26)
            // Flicker
            eye.run(SKAction.repeatForever(SKAction.sequence([
                SKAction.fadeAlpha(to: 0.4, duration: Double.random(in: 0.1...0.3)),
                SKAction.fadeAlpha(to: 1.0, duration: Double.random(in: 0.1...0.3))
            ])))
            body.addChild(eye)
        }

        // Wide carved mouth
        let mouth = SKSpriteNode(color: SKColor(red: 0.15, green: 0.10, blue: 0.07, alpha: 1),
                                  size: CGSize(width: 24, height: 7))
        mouth.position = CGPoint(x: 0, y: height - 40)
        body.addChild(mouth)

        // Headdress / crown
        let crown = SKSpriteNode(color: SKColor(red: 0.28, green: 0.22, blue: 0.14, alpha: 1),
                                  size: CGSize(width: 42, height: 16))
        crown.anchorPoint = CGPoint(x: 0.5, y: 0)
        crown.position = CGPoint(x: 0, y: height)
        body.addChild(crown)

        container.addChild(body)

        let phys = SKPhysicsBody(
            rectangleOf: CGSize(width: 34, height: height),
            center: CGPoint(x: 0, y: height / 2)
        )
        phys.isDynamic = false
        phys.categoryBitMask = PhysicsCategory.obstacle
        phys.contactTestBitMask = PhysicsCategory.player
        phys.collisionBitMask = PhysicsCategory.player
        container.physicsBody = phys

        return container
    }

    private func spawnRockCluster() {
        let container = SKNode()
        container.position = CGPoint(x: frame.maxX + 40, y: groundHeight)
        container.name = "obstacle"

        // 2–3 stacked rocks
        var totalHeight: CGFloat = 0
        let numRocks = Int.random(in: 2...3)
        for i in 0..<numRocks {
            let w = CGFloat.random(in: 28...44)
            let h = CGFloat.random(in: 18...30)
            let rock = SKSpriteNode(color: SKColor(
                red: CGFloat.random(in: 0.28...0.42),
                green: CGFloat.random(in: 0.22...0.32),
                blue: CGFloat.random(in: 0.16...0.24),
                alpha: 1
            ), size: CGSize(width: w, height: h))
            rock.anchorPoint = CGPoint(x: 0.5, y: 0)
            rock.position = CGPoint(x: CGFloat.random(in: -5...5), y: totalHeight)
            container.addChild(rock)
            totalHeight += h - 4
        }

        let phys = SKPhysicsBody(
            rectangleOf: CGSize(width: 40, height: totalHeight),
            center: CGPoint(x: 0, y: totalHeight / 2)
        )
        phys.isDynamic = false
        phys.categoryBitMask = PhysicsCategory.obstacle
        phys.contactTestBitMask = PhysicsCategory.player
        phys.collisionBitMask = PhysicsCategory.player
        container.physicsBody = phys

        addChild(container)

        let duration = Double(frame.width + 80) / Double(groundScrollSpeed)
        container.run(SKAction.sequence([
            SKAction.moveBy(x: -(frame.width + 80), y: 0, duration: duration),
            SKAction.removeFromParent()
        ]))
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

        // Armadillo hop animation
        let squat  = SKAction.scaleX(to: 1.25, y: 0.78, duration: 0.05)
        let spring = SKAction.scaleX(to: 0.82, y: 1.22, duration: 0.10)
        let settle = SKAction.scaleX(to: 1.00, y: 1.00, duration: 0.10)
        playerNode.run(SKAction.sequence([squat, spring, settle]))

        spawnDustPuff(at: playerNode.position)
    }

    private func spawnDustPuff(at point: CGPoint) {
        for _ in 0..<6 {
            let dust = SKSpriteNode(
                color: SKColor(red: 0.30, green: 0.20, blue: 0.10, alpha: 0.65),
                size: CGSize(width: CGFloat.random(in: 4...9), height: CGFloat.random(in: 4...9))
            )
            dust.position = CGPoint(x: point.x + CGFloat.random(in: -14...14),
                                    y: point.y - playerSize.height / 2 + 4)
            dust.zPosition = 5
            dust.name = "dustPuff"
            addChild(dust)
            let drift = SKAction.group([
                SKAction.moveBy(x: CGFloat.random(in: -18...18), y: CGFloat.random(in: 4...18), duration: 0.4),
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

        // Blood moon flash
        let flash = SKAction.sequence([
            SKAction.colorize(with: .tbBloodMoon, colorBlendFactor: 0.85, duration: 0.08),
            SKAction.colorize(with: SKColor(red: 0.45, green: 0.35, blue: 0.22, alpha: 1),
                              colorBlendFactor: 0, duration: 0.45)
        ])
        playerNode.run(flash)

        // Dark overlay
        let overlay = SKSpriteNode(color: SKColor(red: 0, green: 0, blue: 0, alpha: 0.65), size: frame.size)
        overlay.anchorPoint = .zero
        overlay.position = .zero
        overlay.zPosition = 9
        overlay.name = "gameOverBg"
        addChild(overlay)

        // Bamboo-framed panel
        let panelBorder = SKShapeNode(rectOf: CGSize(width: 340, height: 210), cornerRadius: 6)
        panelBorder.strokeColor = .tbBamboo
        panelBorder.fillColor = SKColor(red: 0.07, green: 0.04, blue: 0.02, alpha: 0.92)
        panelBorder.lineWidth = 4
        panelBorder.position = CGPoint(x: frame.midX, y: frame.midY + 10)
        panelBorder.zPosition = 10
        panelBorder.name = "gameOverBorder"
        addChild(panelBorder)

        gameOverLabel = SKLabelNode(fontNamed: "Georgia-Bold")
        gameOverLabel.text = "THE SPIRITS CLAIM YOU"
        gameOverLabel.fontSize = 28
        gameOverLabel.fontColor = .tbBloodMoon
        gameOverLabel.position = CGPoint(x: frame.midX, y: frame.midY + 65)
        gameOverLabel.zPosition = 11
        addChild(gameOverLabel)

        let finalScore = SKLabelNode(fontNamed: "Georgia")
        finalScore.text = "☠️  Score: \(score)"
        finalScore.fontSize = 30
        finalScore.fontColor = .tbGoldBright
        finalScore.position = CGPoint(x: frame.midX, y: frame.midY + 22)
        finalScore.zPosition = 11
        finalScore.name = "finalScore"
        finalScore.alpha = 0
        finalScore.run(SKAction.sequence([SKAction.wait(forDuration: 0.3), SKAction.fadeIn(withDuration: 0.4)]))
        addChild(finalScore)

        restartButton = SKLabelNode(fontNamed: "Georgia-Bold")
        restartButton.text = "Run Again...if you dare"
        restartButton.fontSize = 22
        restartButton.fontColor = .tbGold
        restartButton.position = CGPoint(x: frame.midX, y: frame.midY - 28)
        restartButton.zPosition = 11
        restartButton.run(SKAction.repeatForever(SKAction.sequence([
            SKAction.fadeAlpha(to: 0.3, duration: 0.9),
            SKAction.fadeAlpha(to: 1.0, duration: 0.9)
        ])))
        addChild(restartButton)

        // Slide game over label in from top
        gameOverLabel.position.y += 60
        gameOverLabel.run(SKAction.moveTo(y: frame.midY + 65, duration: 0.4))

        NotificationCenter.default.post(name: .gameDidEnd, object: nil, userInfo: ["score": score])
    }

    // MARK: - Update

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

// MARK: - Notification
extension Notification.Name {
    static let gameDidEnd = Notification.Name("gameDidEnd")
}
