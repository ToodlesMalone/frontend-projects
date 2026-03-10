import Foundation
import Combine

@MainActor
class AIChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isStreaming = false
    @Published var streamingText = ""
    @Published var errorMessage: String? = nil

    private let service: AnthropicService
    private let puppyStore: PuppyStore

    init(puppyStore: PuppyStore) {
        self.puppyStore = puppyStore
        // In production: read from Keychain or secure config.
        // For development: set ANTHROPIC_API_KEY in your scheme environment variables.
        let apiKey = Bundle.main.infoDictionary?["ANTHROPIC_API_KEY"] as? String ?? ""
        self.service = AnthropicService(apiKey: apiKey)

        // Greeting message
        let greeting = greetingMessage()
        messages.append(ChatMessage(role: .assistant, content: greeting))
    }

    func sendMessage(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard !isStreaming else { return }

        let userMessage = ChatMessage(role: .user, content: text)
        messages.append(userMessage)
        isStreaming = true
        streamingText = ""
        errorMessage = nil

        // Build context messages (last 10 for cost efficiency)
        let contextMessages = messages.suffix(10).filter { $0.role != .assistant || messages.last?.id != $0.id }

        Task {
            await service.streamChat(
                messages: contextMessages,
                systemPrompt: buildSystemPrompt(),
                onChunk: { [weak self] chunk in
                    self?.streamingText += chunk
                },
                onComplete: { [weak self] in
                    guard let self = self else { return }
                    let finalText = self.streamingText
                    self.messages.append(ChatMessage(role: .assistant, content: finalText))
                    self.streamingText = ""
                    self.isStreaming = false
                },
                onError: { [weak self] error in
                    self?.errorMessage = error.localizedDescription
                    self?.isStreaming = false
                    self?.streamingText = ""
                }
            )
        }
    }

    func clearHistory() {
        messages = [ChatMessage(role: .assistant, content: greetingMessage())]
    }

    // MARK: - System prompt

    private func buildSystemPrompt() -> String {
        let puppy = puppyStore.puppy
        let name = puppy?.name ?? "your puppy"
        let breed = puppy?.breed ?? "mixed breed"
        let ageWeeks = puppy?.ageInWeeks ?? 0
        let gender = puppy?.gender.rawValue.lowercased() ?? "puppy"
        let weight = puppy.flatMap { $0.weightLbs.map { String(format: "%.1f lbs", $0) } } ?? "unknown weight"

        return """
        You are PuppyStart AI, a warm, expert puppy coach helping new puppy owners raise happy, healthy dogs.

        Current puppy profile:
        - Name: \(name)
        - Breed: \(breed)
        - Age: \(ageWeeks) weeks old
        - Gender: \(gender)
        - Weight: \(weight)

        Your role:
        - Give practical, actionable advice tailored to \(name)'s specific age, breed, and situation
        - Be warm, encouraging, and non-judgmental — new puppy owners are stressed and need support
        - Keep answers concise but thorough. Use bullet points for steps when helpful
        - Always prioritize safety: recommend a vet for medical concerns
        - Reference \(name) by name to make answers feel personal
        - For behavioral issues, use positive reinforcement methods only
        - Acknowledge that puppyhood is hard and celebrate small wins

        Key knowledge areas:
        - Puppy development stages (8 weeks through 1 year)
        - Crate training, potty training, socialization
        - Basic obedience: sit, stay, come, leash walking
        - Nutrition by age and breed size
        - Common health concerns and when to see a vet
        - Sleep schedules and managing puppy crying at night
        - Bite inhibition and nipping
        - Separation anxiety prevention

        Avoid:
        - Punishment-based training methods
        - Medical diagnoses (always recommend a vet)
        - Overwhelming the user with too much information at once
        """
    }

    // MARK: - Greeting

    private func greetingMessage() -> String {
        let name = puppyStore.puppy?.name ?? "your puppy"
        let weeks = puppyStore.puppy?.ageInWeeks ?? 0
        if weeks > 0 {
            return "Hi! I'm your AI puppy coach 🐾 I know \(name) is \(weeks) weeks old, so I'm already up to speed on \(name)'s stage. What can I help you with today?"
        } else {
            return "Hi! I'm your AI puppy coach 🐾 I'm here 24/7 to answer any questions about your new puppy. What can I help you with?"
        }
    }
}
