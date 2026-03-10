import SwiftUI
import StoreKit

struct PaywallView: View {
    @EnvironmentObject var subscriptionManager: SubscriptionManager
    @Environment(\.dismiss) var dismiss
    @State private var selectedProductID: String = SubscriptionManager.yearlyProductID

    var yearlyProduct: Product? {
        subscriptionManager.availableProducts.first { $0.id == SubscriptionManager.yearlyProductID }
    }
    var monthlyProduct: Product? {
        subscriptionManager.availableProducts.first { $0.id == SubscriptionManager.monthlyProductID }
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.15, green: 0.05, blue: 0.35), Color(red: 0.35, green: 0.05, blue: 0.55)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Close button
                HStack {
                    Spacer()
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.6))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                ScrollView {
                    VStack(spacing: 28) {
                        // Header
                        VStack(spacing: 12) {
                            Text("✨")
                                .font(.system(size: 60))
                            Text("PuppyStart Premium")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(.white)
                            Text("Give your puppy the best start with expert guidance and 24/7 AI support")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.8))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }
                        .padding(.top, 8)

                        // Features list
                        VStack(spacing: 14) {
                            PremiumFeatureRow(icon: "bubble.left.and.bubble.right.fill", title: "AI Puppy Coach", subtitle: "24/7 personalized answers powered by Claude AI")
                            PremiumFeatureRow(icon: "figure.walk", title: "Expert Training Programs", subtitle: "Step-by-step programs for every skill")
                            PremiumFeatureRow(icon: "pawprint.fill", title: "Breed-Specific Guides", subtitle: "Tailored advice for your pup's breed")
                            PremiumFeatureRow(icon: "chart.line.uptrend.xyaxis", title: "Advanced Analytics", subtitle: "Potty training trends, feeding insights")
                            PremiumFeatureRow(icon: "bell.fill", title: "Smart Reminders", subtitle: "Never miss a feeding, walk, or vet visit")
                        }
                        .padding(.horizontal, 20)

                        // Pricing options
                        VStack(spacing: 12) {
                            if let yearly = yearlyProduct {
                                PricingOptionCard(
                                    title: "Annual",
                                    price: yearly.displayPrice,
                                    period: "per year",
                                    badge: "BEST VALUE • Save 58%",
                                    isSelected: selectedProductID == yearly.id
                                ) {
                                    selectedProductID = yearly.id
                                }
                            } else {
                                PricingOptionCard(
                                    title: "Annual",
                                    price: "$24.99",
                                    period: "per year",
                                    badge: "BEST VALUE • Save 58%",
                                    isSelected: selectedProductID == SubscriptionManager.yearlyProductID
                                ) {
                                    selectedProductID = SubscriptionManager.yearlyProductID
                                }
                            }

                            if let monthly = monthlyProduct {
                                PricingOptionCard(
                                    title: "Monthly",
                                    price: monthly.displayPrice,
                                    period: "per month",
                                    badge: nil,
                                    isSelected: selectedProductID == monthly.id
                                ) {
                                    selectedProductID = monthly.id
                                }
                            } else {
                                PricingOptionCard(
                                    title: "Monthly",
                                    price: "$4.99",
                                    period: "per month",
                                    badge: nil,
                                    isSelected: selectedProductID == SubscriptionManager.monthlyProductID
                                ) {
                                    selectedProductID = SubscriptionManager.monthlyProductID
                                }
                            }
                        }
                        .padding(.horizontal, 20)

                        // CTA Button
                        Button(action: purchase) {
                            ZStack {
                                if subscriptionManager.isLoading {
                                    ProgressView().tint(.purple)
                                } else {
                                    Text("Start Premium")
                                        .font(.headline)
                                        .foregroundColor(.purple)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(Color.white)
                            .cornerRadius(16)
                        }
                        .padding(.horizontal, 20)
                        .disabled(subscriptionManager.isLoading)

                        if let error = subscriptionManager.purchaseError {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red.opacity(0.8))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }

                        // Fine print
                        VStack(spacing: 8) {
                            Button("Restore Purchases") {
                                Task { await subscriptionManager.restorePurchases() }
                            }
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.6))

                            Text("Cancel anytime. Subscription renews automatically. Payment charged to your Apple ID account.")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.4))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }
                        .padding(.bottom, 40)
                    }
                }
            }
        }
        .onAppear {
            if subscriptionManager.isPremium { dismiss() }
        }
    }

    private func purchase() {
        let targetID = selectedProductID
        Task {
            if let product = subscriptionManager.availableProducts.first(where: { $0.id == targetID }) {
                await subscriptionManager.purchase(product)
                if subscriptionManager.isPremium { dismiss() }
            }
        }
    }
}

struct PremiumFeatureRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.yellow)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.bold()).foregroundColor(.white)
                Text(subtitle).font(.caption).foregroundColor(.white.opacity(0.65))
            }
            Spacer()
        }
    }
}

struct PricingOptionCard: View {
    let title: String
    let price: String
    let period: String
    let badge: String?
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(title)
                            .font(.headline)
                            .foregroundColor(.white)
                        if let badge = badge {
                            Text(badge)
                                .font(.caption2.bold())
                                .foregroundColor(.purple)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(Color.yellow)
                                .cornerRadius(4)
                        }
                    }
                    Text("\(price) \(period)")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.75))
                }
                Spacer()
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(isSelected ? .yellow : .white.opacity(0.4))
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? Color.yellow : Color.white.opacity(0.2), lineWidth: isSelected ? 2 : 1)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(isSelected ? Color.white.opacity(0.1) : Color.clear)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
