import StoreKit
import Combine

/// Manages all in-app purchases via StoreKit 2.
/// Product IDs must be registered in App Store Connect.
@MainActor
class SubscriptionManager: ObservableObject {
    @Published var isPremium: Bool = false
    @Published var availableProducts: [Product] = []
    @Published var purchaseError: String? = nil
    @Published var isLoading: Bool = false

    // MARK: - Product IDs (register these in App Store Connect)
    static let monthlyProductID = "com.puppystart.premium.monthly"   // $4.99/month
    static let yearlyProductID  = "com.puppystart.premium.yearly"    // $24.99/year

    private var updateListenerTask: Task<Void, Never>?

    init() {
        updateListenerTask = listenForTransactions()
        Task { await loadProducts() }
        Task { await refreshPurchaseStatus() }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    // MARK: - Load products from App Store Connect

    func loadProducts() async {
        isLoading = true
        do {
            let products = try await Product.products(for: [
                SubscriptionManager.monthlyProductID,
                SubscriptionManager.yearlyProductID,
            ])
            availableProducts = products.sorted { $0.price < $1.price }
        } catch {
            purchaseError = "Failed to load products: \(error.localizedDescription)"
        }
        isLoading = false
    }

    // MARK: - Purchase

    func purchase(_ product: Product) async {
        isLoading = true
        purchaseError = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await transaction.finish()
                await refreshPurchaseStatus()
            case .userCancelled:
                break
            case .pending:
                purchaseError = "Purchase is pending approval."
            @unknown default:
                break
            }
        } catch {
            purchaseError = "Purchase failed: \(error.localizedDescription)"
        }
        isLoading = false
    }

    // MARK: - Restore purchases

    func restorePurchases() async {
        isLoading = true
        do {
            try await AppStore.sync()
            await refreshPurchaseStatus()
        } catch {
            purchaseError = "Restore failed: \(error.localizedDescription)"
        }
        isLoading = false
    }

    // MARK: - Verify entitlement

    func refreshPurchaseStatus() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                if transaction.productID == SubscriptionManager.monthlyProductID ||
                   transaction.productID == SubscriptionManager.yearlyProductID {
                    isPremium = transaction.revocationDate == nil
                }
            }
        }
    }

    // MARK: - Listen for external transaction updates

    private func listenForTransactions() -> Task<Void, Never> {
        Task(priority: .background) {
            for await result in Transaction.updates {
                do {
                    let transaction = try checkVerified(result)
                    await transaction.finish()
                    await refreshPurchaseStatus()
                } catch {
                    // Invalid transaction, ignore
                }
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified: throw StoreError.failedVerification
        case .verified(let safe): return safe
        }
    }
}

enum StoreError: Error {
    case failedVerification
}
