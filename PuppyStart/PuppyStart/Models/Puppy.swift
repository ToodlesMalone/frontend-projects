import Foundation

struct Puppy: Codable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var breed: String
    var birthDate: Date
    var photoData: Data?
    var weightLbs: Double?
    var gender: Gender

    enum Gender: String, Codable, CaseIterable {
        case male = "Male"
        case female = "Female"
    }

    var ageInWeeks: Int {
        Calendar.current.dateComponents([.weekOfYear], from: birthDate, to: Date()).weekOfYear ?? 0
    }

    var ageInDays: Int {
        Calendar.current.dateComponents([.day], from: birthDate, to: Date()).day ?? 0
    }

    var ageDescription: String {
        let weeks = ageInWeeks
        if weeks < 1 { return "Newborn" }
        if weeks == 1 { return "1 week old" }
        if weeks < 52 { return "\(weeks) weeks old" }
        let months = weeks / 4
        return "\(months) month\(months == 1 ? "" : "s") old"
    }
}

struct FeedingLog: Codable, Identifiable {
    var id: UUID = UUID()
    var timestamp: Date
    var amountCups: Double
    var notes: String?
}

struct PottyLog: Codable, Identifiable {
    var id: UUID = UUID()
    var timestamp: Date
    var type: PottyType
    var wasAccident: Bool
    var location: String?

    enum PottyType: String, Codable, CaseIterable {
        case pee = "Pee"
        case poop = "Poop"
        case both = "Both"
    }
}

struct Vaccination: Codable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var scheduledDate: Date
    var completedDate: Date?
    var notes: String?
    var isCompleted: Bool { completedDate != nil }

    static func defaultSchedule(from birthDate: Date) -> [Vaccination] {
        let cal = Calendar.current
        return [
            Vaccination(name: "DHPP (1st)", scheduledDate: cal.date(byAdding: .weekOfYear, value: 8, to: birthDate)!),
            Vaccination(name: "DHPP (2nd)", scheduledDate: cal.date(byAdding: .weekOfYear, value: 12, to: birthDate)!),
            Vaccination(name: "DHPP (3rd)", scheduledDate: cal.date(byAdding: .weekOfYear, value: 16, to: birthDate)!),
            Vaccination(name: "Rabies", scheduledDate: cal.date(byAdding: .weekOfYear, value: 16, to: birthDate)!),
            Vaccination(name: "Bordetella", scheduledDate: cal.date(byAdding: .weekOfYear, value: 12, to: birthDate)!),
            Vaccination(name: "Leptospirosis", scheduledDate: cal.date(byAdding: .weekOfYear, value: 12, to: birthDate)!),
        ]
    }
}

struct TrainingSession: Codable, Identifiable {
    var id: UUID = UUID()
    var date: Date
    var skill: String
    var durationMinutes: Int
    var rating: Int // 1-5
    var notes: String?
}

struct Milestone: Codable, Identifiable {
    var id: UUID = UUID()
    var weekNumber: Int
    var title: String
    var description: String
    var tips: [String]
    var photoPrompt: String?

    static let allMilestones: [Milestone] = [
        Milestone(weekNumber: 8, title: "First Week Home 🏠",
                  description: "Your puppy just arrived! This is the most critical bonding week. Expect some crying at night — this is normal.",
                  tips: ["Keep a consistent sleep spot", "Limit visitors for the first few days", "Start crate training immediately", "No outdoor walks until vaccinations"],
                  photoPrompt: "First day home!"),
        Milestone(weekNumber: 9, title: "Settling In",
                  description: "Your puppy is learning the layout of the home and starting to recognize your voice and scent.",
                  tips: ["Begin name recognition training", "Introduce 'sit' command", "Establish feeding schedule", "Puppy-proof common areas"],
                  photoPrompt: "Exploring the house"),
        Milestone(weekNumber: 10, title: "Socialization Window",
                  description: "The socialization window is open. Expose your puppy to sounds, surfaces, and people safely.",
                  tips: ["Introduce different floor textures", "Play recordings of thunder, sirens", "Meet vaccinated friendly dogs", "Handle paws, ears, mouth daily"],
                  photoPrompt: "First friend!"),
        Milestone(weekNumber: 12, title: "First Vaccinations",
                  description: "Time for the 2nd round of vaccines. After this, limited outdoor socialization is possible.",
                  tips: ["Schedule vet appointment", "Bring vaccination records", "Ask about heartworm prevention", "Puppy classes can start now"],
                  photoPrompt: "Brave pup at the vet!"),
        Milestone(weekNumber: 16, title: "Adolescence Begins",
                  description: "Final puppy vaccines. Your puppy may start testing boundaries — stay consistent with training.",
                  tips: ["Reinforce all basic commands", "Leash training priority", "Start leaving alone for short periods", "Watch for fear stages"],
                  photoPrompt: "Growing so fast!"),
        Milestone(weekNumber: 24, title: "6 Months Old",
                  description: "Your puppy is half a year old! Basic commands should be solid. Consider advanced training.",
                  tips: ["Spay/neuter discussion with vet", "Introduce off-leash training in safe areas", "Dental chews for teething", "Enroll in intermediate obedience"],
                  photoPrompt: "Half birthday!"),
        Milestone(weekNumber: 52, title: "1 Year Old! 🎂",
                  description: "Your puppy is now officially a dog! Transition to adult food based on breed size.",
                  tips: ["Switch to adult food gradually", "Annual wellness exam", "Update vaccinations", "Celebrate!"],
                  photoPrompt: "Happy 1st birthday!"),
    ]
}
