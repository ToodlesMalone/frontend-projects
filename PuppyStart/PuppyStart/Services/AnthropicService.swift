import Foundation

/// Calls the Anthropic Messages API directly via URLSession with SSE streaming.
/// Model: claude-opus-4-6 with adaptive thinking for best reasoning quality.
actor AnthropicService {
    // MARK: - Configuration
    // Store your API key in Info.plist under "ANTHROPIC_API_KEY"
    // or inject via dependency injection in production.
    private let apiKey: String
    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    private let model = "claude-opus-4-6"

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    // MARK: - Streaming chat

    /// Streams a response from Claude, yielding text chunks as they arrive.
    func streamChat(
        messages: [ChatMessage],
        systemPrompt: String,
        onChunk: @escaping (String) -> Void,
        onComplete: @escaping () -> Void,
        onError: @escaping (Error) -> Void
    ) {
        let requestBody = buildRequestBody(messages: messages, systemPrompt: systemPrompt)

        guard let bodyData = try? JSONSerialization.data(withJSONObject: requestBody) else {
            onError(AnthropicError.encodingFailed)
            return
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.httpBody = bodyData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                onError(error)
                return
            }
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse else {
                onError(AnthropicError.noResponse)
                return
            }
            guard httpResponse.statusCode == 200 else {
                let body = String(data: data, encoding: .utf8) ?? "Unknown error"
                onError(AnthropicError.apiError(statusCode: httpResponse.statusCode, body: body))
                return
            }

            // Parse SSE events
            if let text = String(data: data, encoding: .utf8) {
                for line in text.components(separatedBy: "\n") {
                    if line.hasPrefix("data: ") {
                        let jsonStr = String(line.dropFirst(6))
                        if jsonStr == "[DONE]" { break }
                        if let chunkData = jsonStr.data(using: .utf8),
                           let json = try? JSONSerialization.jsonObject(with: chunkData) as? [String: Any],
                           let delta = json["delta"] as? [String: Any],
                           let chunkText = delta["text"] as? String {
                            DispatchQueue.main.async { onChunk(chunkText) }
                        }
                    }
                }
            }
            DispatchQueue.main.async { onComplete() }
        }
        task.resume()
    }

    // MARK: - Request builder

    private func buildRequestBody(messages: [ChatMessage], systemPrompt: String) -> [String: Any] {
        let formattedMessages: [[String: Any]] = messages.map { msg in
            ["role": msg.role.rawValue, "content": msg.content]
        }

        return [
            "model": model,
            "max_tokens": 1024,
            "stream": true,
            "thinking": ["type": "adaptive"],
            "system": systemPrompt,
            "messages": formattedMessages
        ]
    }
}

// MARK: - Supporting types

struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let role: ChatRole
    let content: String
    let timestamp: Date

    init(role: ChatRole, content: String) {
        self.id = UUID()
        self.role = role
        self.content = content
        self.timestamp = Date()
    }

    enum ChatRole: String, Codable {
        case user
        case assistant
    }
}

enum AnthropicError: LocalizedError {
    case encodingFailed
    case noResponse
    case apiError(statusCode: Int, body: String)

    var errorDescription: String? {
        switch self {
        case .encodingFailed: return "Failed to encode request."
        case .noResponse: return "No response from server."
        case .apiError(let code, let body): return "API error \(code): \(body)"
        }
    }
}
