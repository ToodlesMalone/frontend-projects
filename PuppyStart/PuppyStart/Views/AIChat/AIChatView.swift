import SwiftUI

struct AIChatView: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @EnvironmentObject var subscriptionManager: SubscriptionManager
    @StateObject private var viewModel: AIChatViewModel
    @State private var inputText = ""
    @State private var showUpgradeSheet = false
    @FocusState private var isInputFocused: Bool

    let suggestedQuestions = [
        "My puppy keeps nipping — how do I stop it?",
        "How do I get my puppy to sleep through the night?",
        "Is my puppy eating enough?",
        "When should I start leash training?",
        "My puppy had an accident inside — what should I do?",
    ]

    init(puppyStore: PuppyStore) {
        _viewModel = StateObject(wrappedValue: AIChatViewModel(puppyStore: puppyStore))
    }

    var body: some View {
        NavigationView {
            Group {
                if subscriptionManager.isPremium {
                    chatBody
                } else {
                    premiumGate
                }
            }
            .navigationTitle("AI Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if subscriptionManager.isPremium {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: viewModel.clearHistory) {
                            Image(systemName: "arrow.counterclockwise")
                                .foregroundColor(Color("BrandOrange"))
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showUpgradeSheet) { PaywallView() }
    }

    // MARK: - Chat Body

    var chatBody: some View {
        VStack(spacing: 0) {
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }

                        // Streaming bubble
                        if viewModel.isStreaming {
                            if viewModel.streamingText.isEmpty {
                                TypingIndicator()
                            } else {
                                StreamingBubble(text: viewModel.streamingText)
                            }
                        }

                        // Error
                        if let error = viewModel.errorMessage {
                            ErrorBubble(message: error)
                        }

                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .onChange(of: viewModel.messages.count) { _ in
                    withAnimation { proxy.scrollTo("bottom") }
                }
                .onChange(of: viewModel.streamingText) { _ in
                    proxy.scrollTo("bottom")
                }
            }

            Divider()

            // Suggested questions (shown when only greeting is present)
            if viewModel.messages.count <= 1 && !viewModel.isStreaming {
                SuggestedQuestionsRow(questions: suggestedQuestions) { q in
                    sendMessage(q)
                }
            }

            // Input bar
            HStack(spacing: 10) {
                TextField("Ask anything about \(puppyStore.puppy?.name ?? "your puppy")...", text: $inputText, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color(.systemGray6))
                    .cornerRadius(20)
                    .focused($isInputFocused)

                Button(action: { sendMessage(inputText) }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 34))
                        .foregroundColor(canSend ? Color("BrandOrange") : Color(.systemGray4))
                }
                .disabled(!canSend)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(.systemBackground))
        }
    }

    var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespaces).isEmpty && !viewModel.isStreaming
    }

    func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        inputText = ""
        isInputFocused = false
        viewModel.sendMessage(trimmed)
    }

    // MARK: - Premium gate

    var premiumGate: some View {
        VStack(spacing: 28) {
            Spacer()
            Text("🤖")
                .font(.system(size: 70))
            Text("Meet Your AI Puppy Coach")
                .font(.title2.bold())
                .multilineTextAlignment(.center)
            Text("Get 24/7 personalized answers about \(puppyStore.puppy?.name ?? "your puppy") — powered by Claude AI.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            VStack(alignment: .leading, spacing: 14) {
                FeatureRow(icon: "bubble.left.and.bubble.right.fill", text: "Ask anything, anytime")
                FeatureRow(icon: "pawprint.fill", text: "Answers tailored to your puppy's age & breed")
                FeatureRow(icon: "heart.fill", text: "Supportive, non-judgmental coaching")
                FeatureRow(icon: "bolt.fill", text: "Instant responses, no waiting")
            }
            .padding(.horizontal, 40)

            Button(action: { showUpgradeSheet = true }) {
                Text("Unlock AI Coach — $4.99/mo")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(colors: [Color.purple, Color.pink],
                                       startPoint: .leading, endPoint: .trailing)
                    )
                    .cornerRadius(16)
            }
            .padding(.horizontal, 32)

            Text("Or $24.99/year — cancel anytime")
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
    }
}

// MARK: - Message Components

struct MessageBubble: View {
    let message: ChatMessage
    var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUser { Spacer(minLength: 60) }
            if !isUser {
                Text("🐾")
                    .font(.caption)
                    .padding(6)
                    .background(Color(.systemGray5))
                    .clipShape(Circle())
            }

            Text(message.content)
                .font(.body)
                .foregroundColor(isUser ? .white : .primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? Color("BrandOrange") : Color(.systemGray6))
                .cornerRadius(isUser ? 18 : 18, antialiased: true)
                .cornerRadius(isUser ? 4 : 4)

            if isUser {
                Image(systemName: "person.circle.fill")
                    .font(.title3)
                    .foregroundColor(Color("BrandOrange"))
            }
            if !isUser { Spacer(minLength: 60) }
        }
    }
}

struct StreamingBubble: View {
    let text: String

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Text("🐾")
                .font(.caption)
                .padding(6)
                .background(Color(.systemGray5))
                .clipShape(Circle())

            Text(text + "▌")
                .font(.body)
                .foregroundColor(.primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.systemGray6))
                .cornerRadius(18)

            Spacer(minLength: 60)
        }
    }
}

struct TypingIndicator: View {
    @State private var dot1 = false
    @State private var dot2 = false
    @State private var dot3 = false

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Text("🐾")
                .font(.caption)
                .padding(6)
                .background(Color(.systemGray5))
                .clipShape(Circle())

            HStack(spacing: 4) {
                ForEach([dot1, dot2, dot3].indices, id: \.self) { i in
                    Circle()
                        .fill(Color.secondary)
                        .frame(width: 7, height: 7)
                        .scaleEffect([dot1, dot2, dot3][i] ? 1.3 : 0.8)
                        .animation(.easeInOut(duration: 0.5).repeatForever().delay(Double(i) * 0.15), value: [dot1, dot2, dot3][i])
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(.systemGray6))
            .cornerRadius(18)

            Spacer(minLength: 60)
        }
        .onAppear {
            dot1 = true
            dot2 = true
            dot3 = true
        }
    }
}

struct ErrorBubble: View {
    let message: String

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)
            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(10)
        .background(Color.orange.opacity(0.1))
        .cornerRadius(10)
    }
}

struct SuggestedQuestionsRow: View {
    let questions: [String]
    let onTap: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(questions, id: \.self) { q in
                    Button(action: { onTap(q) }) {
                        Text(q)
                            .font(.caption)
                            .foregroundColor(Color("BrandOrange"))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color("BrandOrange").opacity(0.1))
                            .cornerRadius(16)
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(Color("BrandOrange").opacity(0.3), lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color(.systemBackground))
    }
}

// MARK: - Workaround for two-value cornerRadius (Swift doesn't have it natively)
extension View {
    func cornerRadius(_ radius: CGFloat, antialiased: Bool) -> some View {
        self.clipShape(RoundedRectangle(cornerRadius: radius, style: antialiased ? .continuous : .circular))
    }
}
