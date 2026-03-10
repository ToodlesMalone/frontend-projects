import SwiftUI

struct LogsView: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @State private var selectedTab = 0
    @State private var showFeedingSheet = false
    @State private var showPottySheet = false
    @State private var showVaccinationsSheet = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("Log Type", selection: $selectedTab) {
                    Text("Feeding").tag(0)
                    Text("Potty").tag(1)
                    Text("Vaccines").tag(2)
                }
                .pickerStyle(.segmented)
                .padding()

                TabView(selection: $selectedTab) {
                    FeedingHistoryList().tag(0)
                    PottyHistoryList().tag(1)
                    VaccinationsView().tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            .navigationTitle("Logs")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        if selectedTab == 0 { showFeedingSheet = true }
                        else if selectedTab == 1 { showPottySheet = true }
                    }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(Color("BrandOrange"))
                    }
                    .opacity(selectedTab == 2 ? 0 : 1)
                }
            }
        }
        .sheet(isPresented: $showFeedingSheet) { FeedingLogSheet() }
        .sheet(isPresented: $showPottySheet) { PottyLogSheet() }
    }
}

struct FeedingHistoryList: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        List {
            if puppyStore.feedingLogs.isEmpty {
                EmptyLogView(icon: "fork.knife", message: "No feeding logs yet.\nTap + to log a meal.")
            } else {
                ForEach(groupedByDay(puppyStore.feedingLogs), id: \.key) { day, logs in
                    Section(header: Text(dayLabel(day))) {
                        ForEach(logs) { log in
                            HStack {
                                Image(systemName: "fork.knife.circle.fill")
                                    .foregroundColor(Color("BrandOrange"))
                                    .font(.title3)
                                VStack(alignment: .leading) {
                                    Text("\(String(format: "%.2f", log.amountCups)) cups")
                                        .font(.subheadline.bold())
                                    if let notes = log.notes {
                                        Text(notes).font(.caption).foregroundColor(.secondary)
                                    }
                                }
                                Spacer()
                                Text(log.timestamp, style: .time)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    func groupedByDay(_ logs: [FeedingLog]) -> [(key: Date, value: [FeedingLog])] {
        let grouped = Dictionary(grouping: logs) { Calendar.current.startOfDay(for: $0.timestamp) }
        return grouped.sorted { $0.key > $1.key }
    }

    func dayLabel(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

struct PottyHistoryList: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        List {
            if puppyStore.pottyLogs.isEmpty {
                EmptyLogView(icon: "drop.fill", message: "No potty logs yet.\nTap + to log a trip.")
            } else {
                // Summary today
                let today = Calendar.current.startOfDay(for: Date())
                let todayLogs = puppyStore.pottyLogs.filter { Calendar.current.startOfDay(for: $0.timestamp) == today }
                let accidents = todayLogs.filter { $0.wasAccident }.count
                let successes = todayLogs.filter { !$0.wasAccident }.count

                Section("Today's Summary") {
                    HStack(spacing: 20) {
                        VStack {
                            Text("\(successes)")
                                .font(.title.bold())
                                .foregroundColor(.green)
                            Text("Successes")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Divider()
                        VStack {
                            Text("\(accidents)")
                                .font(.title.bold())
                                .foregroundColor(accidents == 0 ? .green : .orange)
                            Text("Accidents")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        if accidents == 0 && successes > 0 {
                            Text("🎉 Perfect day!")
                                .font(.caption.bold())
                                .foregroundColor(.green)
                        }
                    }
                    .padding(.vertical, 4)
                }

                ForEach(puppyStore.pottyLogs.prefix(30)) { log in
                    HStack {
                        Image(systemName: log.wasAccident ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                            .foregroundColor(log.wasAccident ? .orange : .green)
                            .font(.title3)
                        VStack(alignment: .leading) {
                            Text(log.type.rawValue).font(.subheadline.bold())
                            if let loc = log.location {
                                Text(loc).font(.caption).foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        Text(log.timestamp, style: .relative)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

struct VaccinationsView: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        List {
            Section("Upcoming") {
                let upcoming = puppyStore.vaccinations.filter { !$0.isCompleted }.sorted { $0.scheduledDate < $1.scheduledDate }
                if upcoming.isEmpty {
                    Text("All vaccinations complete! 🎉")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(upcoming) { vax in
                        VaccinationRow(vaccination: vax)
                    }
                }
            }
            Section("Completed") {
                let completed = puppyStore.vaccinations.filter { $0.isCompleted }
                if completed.isEmpty {
                    Text("None yet")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(completed) { vax in
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text(vax.name)
                            Spacer()
                            if let date = vax.completedDate {
                                Text(date, style: .date)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

struct VaccinationRow: View {
    @EnvironmentObject var puppyStore: PuppyStore
    let vaccination: Vaccination

    var isOverdue: Bool {
        vaccination.scheduledDate < Date()
    }

    var body: some View {
        HStack {
            Image(systemName: "syringe.fill")
                .foregroundColor(isOverdue ? .red : .purple)
            VStack(alignment: .leading) {
                Text(vaccination.name).font(.subheadline.bold())
                Text(vaccination.scheduledDate, style: .date)
                    .font(.caption)
                    .foregroundColor(isOverdue ? .red : .secondary)
            }
            Spacer()
            Button("Done") {
                puppyStore.markVaccinationComplete(vaccination)
            }
            .font(.caption.bold())
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.purple)
            .cornerRadius(8)
        }
    }
}

struct EmptyLogView: View {
    let icon: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundColor(.secondary.opacity(0.5))
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
        .listRowBackground(Color.clear)
    }
}
