import SwiftUI

struct FeedingLogSheet: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @Environment(\.dismiss) var dismiss
    @State private var amountCups: Double = 0.5
    @State private var notes = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Amount") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(String(format: "%.2f", amountCups)) cups")
                            .font(.title2.bold())
                            .foregroundColor(Color("BrandOrange"))
                        Slider(value: $amountCups, in: 0.25...3.0, step: 0.25)
                            .accentColor(Color("BrandOrange"))
                    }
                    .padding(.vertical, 4)
                }

                Section("Notes (optional)") {
                    TextField("e.g. ate slowly, spilled some...", text: $notes, axis: .vertical)
                        .lineLimit(3)
                }

                Section {
                    // Recent feedings
                    let todayFeedings = puppyStore.feedingLogs.prefix(5)
                    if !todayFeedings.isEmpty {
                        ForEach(todayFeedings) { log in
                            HStack {
                                Image(systemName: "fork.knife")
                                    .foregroundColor(.secondary)
                                Text("\(String(format: "%.2f", log.amountCups)) cups")
                                Spacer()
                                Text(log.timestamp, style: .time)
                                    .foregroundColor(.secondary)
                                    .font(.caption)
                            }
                        }
                    }
                } header: {
                    Text("Recent Feedings")
                }
            }
            .navigationTitle("Log Feeding")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        puppyStore.logFeeding(amountCups: amountCups, notes: notes.isEmpty ? nil : notes)
                        dismiss()
                    }
                    .fontWeight(.bold)
                    .foregroundColor(Color("BrandOrange"))
                }
            }
        }
    }
}
