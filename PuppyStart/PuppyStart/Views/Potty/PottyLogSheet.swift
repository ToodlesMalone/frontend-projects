import SwiftUI

struct PottyLogSheet: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @Environment(\.dismiss) var dismiss
    @State private var selectedType: PottyLog.PottyType = .pee
    @State private var wasAccident = false
    @State private var location = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Type") {
                    Picker("Type", selection: $selectedType) {
                        ForEach(PottyLog.PottyType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.vertical, 4)
                }

                Section {
                    Toggle(isOn: $wasAccident) {
                        HStack {
                            Image(systemName: wasAccident ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                                .foregroundColor(wasAccident ? .orange : .green)
                            Text(wasAccident ? "Was an accident" : "Made it outside!")
                        }
                    }
                    .tint(Color("BrandOrange"))
                } header: {
                    Text("Did they make it?")
                }

                Section("Location (optional)") {
                    TextField("e.g. backyard, front door...", text: $location)
                }

                Section {
                    let today = Calendar.current.startOfDay(for: Date())
                    let todayLogs = puppyStore.pottyLogs
                        .filter { Calendar.current.startOfDay(for: $0.timestamp) == today }
                        .prefix(5)
                    if !todayLogs.isEmpty {
                        ForEach(todayLogs) { log in
                            HStack {
                                Image(systemName: log.wasAccident ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                                    .foregroundColor(log.wasAccident ? .orange : .green)
                                Text(log.type.rawValue)
                                Spacer()
                                Text(log.timestamp, style: .time)
                                    .foregroundColor(.secondary)
                                    .font(.caption)
                            }
                        }
                    } else {
                        Text("No logs yet today")
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Today's Logs")
                }
            }
            .navigationTitle("Log Potty")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        puppyStore.logPotty(
                            type: selectedType,
                            wasAccident: wasAccident,
                            location: location.isEmpty ? nil : location
                        )
                        dismiss()
                    }
                    .fontWeight(.bold)
                    .foregroundColor(Color("BrandOrange"))
                }
            }
        }
    }
}
