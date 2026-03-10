import Foundation
import Combine

class PuppyStore: ObservableObject {
    @Published var puppy: Puppy?
    @Published var feedingLogs: [FeedingLog] = []
    @Published var pottyLogs: [PottyLog] = []
    @Published var vaccinations: [Vaccination] = []
    @Published var trainingSessions: [TrainingSession] = []

    private let puppyKey = "saved_puppy"
    private let feedingKey = "feeding_logs"
    private let pottyKey = "potty_logs"
    private let vaccinationKey = "vaccinations"
    private let trainingKey = "training_sessions"

    init() {
        load()
    }

    func savePuppy(_ puppy: Puppy) {
        self.puppy = puppy
        self.vaccinations = Vaccination.defaultSchedule(from: puppy.birthDate)
        persist()
    }

    func logFeeding(amountCups: Double, notes: String? = nil) {
        let log = FeedingLog(timestamp: Date(), amountCups: amountCups, notes: notes)
        feedingLogs.insert(log, at: 0)
        persist()
    }

    func logPotty(type: PottyLog.PottyType, wasAccident: Bool, location: String? = nil) {
        let log = PottyLog(timestamp: Date(), type: type, wasAccident: wasAccident, location: location)
        pottyLogs.insert(log, at: 0)
        persist()
    }

    func markVaccinationComplete(_ vaccination: Vaccination) {
        if let index = vaccinations.firstIndex(where: { $0.id == vaccination.id }) {
            vaccinations[index].completedDate = Date()
            persist()
        }
    }

    func logTrainingSession(_ session: TrainingSession) {
        trainingSessions.insert(session, at: 0)
        persist()
    }

    var todayFeedingCount: Int {
        let today = Calendar.current.startOfDay(for: Date())
        return feedingLogs.filter { Calendar.current.startOfDay(for: $0.timestamp) == today }.count
    }

    var todayPottyCount: Int {
        let today = Calendar.current.startOfDay(for: Date())
        return pottyLogs.filter { Calendar.current.startOfDay(for: $0.timestamp) == today }.count
    }

    var todayAccidentCount: Int {
        let today = Calendar.current.startOfDay(for: Date())
        return pottyLogs.filter {
            Calendar.current.startOfDay(for: $0.timestamp) == today && $0.wasAccident
        }.count
    }

    var upcomingVaccinations: [Vaccination] {
        vaccinations
            .filter { !$0.isCompleted && $0.scheduledDate >= Date() }
            .sorted { $0.scheduledDate < $1.scheduledDate }
    }

    var currentMilestone: Milestone? {
        guard let puppy = puppy else { return nil }
        return Milestone.allMilestones
            .filter { $0.weekNumber <= puppy.ageInWeeks }
            .last ?? Milestone.allMilestones.first
    }

    var nextMilestone: Milestone? {
        guard let puppy = puppy else { return nil }
        return Milestone.allMilestones.first { $0.weekNumber > puppy.ageInWeeks }
    }

    // MARK: - Persistence

    private func persist() {
        let encoder = JSONEncoder()
        if let puppy = puppy, let data = try? encoder.encode(puppy) {
            UserDefaults.standard.set(data, forKey: puppyKey)
        }
        if let data = try? encoder.encode(feedingLogs) {
            UserDefaults.standard.set(data, forKey: feedingKey)
        }
        if let data = try? encoder.encode(pottyLogs) {
            UserDefaults.standard.set(data, forKey: pottyKey)
        }
        if let data = try? encoder.encode(vaccinations) {
            UserDefaults.standard.set(data, forKey: vaccinationKey)
        }
        if let data = try? encoder.encode(trainingSessions) {
            UserDefaults.standard.set(data, forKey: trainingKey)
        }
    }

    private func load() {
        let decoder = JSONDecoder()
        if let data = UserDefaults.standard.data(forKey: puppyKey),
           let saved = try? decoder.decode(Puppy.self, from: data) {
            puppy = saved
        }
        if let data = UserDefaults.standard.data(forKey: feedingKey),
           let saved = try? decoder.decode([FeedingLog].self, from: data) {
            feedingLogs = saved
        }
        if let data = UserDefaults.standard.data(forKey: pottyKey),
           let saved = try? decoder.decode([PottyLog].self, from: data) {
            pottyLogs = saved
        }
        if let data = UserDefaults.standard.data(forKey: vaccinationKey),
           let saved = try? decoder.decode([Vaccination].self, from: data) {
            vaccinations = saved
        }
        if let data = UserDefaults.standard.data(forKey: trainingKey),
           let saved = try? decoder.decode([TrainingSession].self, from: data) {
            trainingSessions = saved
        }
    }
}
