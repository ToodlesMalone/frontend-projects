import SwiftUI

struct TrainingView: View {
    @EnvironmentObject var subscriptionManager: SubscriptionManager
    @State private var showUpgradeSheet = false

    let programs: [TrainingProgram] = TrainingProgram.allPrograms

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Free section
                    SectionHeader(title: "Starter Skills", subtitle: "Free for all puppies")
                    VStack(spacing: 12) {
                        ForEach(programs.filter { !$0.isPremium }) { program in
                            TrainingProgramCard(program: program, isLocked: false)
                        }
                    }

                    // Premium section
                    SectionHeader(
                        title: "Advanced Programs",
                        subtitle: subscriptionManager.isPremium ? "Premium unlocked ✓" : "Premium only"
                    )
                    VStack(spacing: 12) {
                        ForEach(programs.filter { $0.isPremium }) { program in
                            TrainingProgramCard(
                                program: program,
                                isLocked: !subscriptionManager.isPremium,
                                onLockedTap: { showUpgradeSheet = true }
                            )
                        }
                    }

                    if !subscriptionManager.isPremium {
                        PremiumUpsellCard(onTap: { showUpgradeSheet = true })
                    }
                }
                .padding(16)
            }
            .navigationTitle("Training")
            .navigationBarTitleDisplayMode(.large)
        }
        .sheet(isPresented: $showUpgradeSheet) { PaywallView() }
    }
}

struct SectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(subtitle).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
        }
    }
}

struct TrainingProgram: Identifiable {
    var id = UUID()
    var title: String
    var description: String
    var icon: String
    var color: Color
    var durationWeeks: Int
    var isPremium: Bool
    var lessons: [TrainingLesson]

    static let allPrograms: [TrainingProgram] = [
        TrainingProgram(
            title: "Sit & Stay",
            description: "The foundation of all training. Master sit and stay in 5 days.",
            icon: "hand.raised.fill",
            color: .green,
            durationWeeks: 1,
            isPremium: false,
            lessons: [
                TrainingLesson(day: 1, title: "Introduction to Sit", duration: "5 min", instructions: "Hold a treat close to your puppy's nose, then slowly raise your hand. As their head follows the treat, their bottom will lower. Once they're sitting, say 'Sit', give the treat and praise."),
                TrainingLesson(day: 2, title: "Reinforcing Sit", duration: "5 min", instructions: "Ask your puppy to sit 10 times throughout the day. Always reward immediately. Begin fading the treat by rewarding every other time."),
                TrainingLesson(day: 3, title: "Adding Duration", duration: "5-10 min", instructions: "Ask your puppy to sit, then wait 2 seconds before rewarding. Gradually increase to 5 seconds, then 10. Say 'Okay' as a release word."),
                TrainingLesson(day: 4, title: "Introducing Stay", duration: "5-10 min", instructions: "Ask your puppy to sit. Take one step back, return, and reward. Gradually increase distance. Always return to your puppy before releasing — don't call them to you yet."),
                TrainingLesson(day: 5, title: "Sit + Stay Practice", duration: "10 min", instructions: "Combine sit and stay. Aim for 5-second stays at 3 feet. Practice in different rooms. Celebrate any success with extra enthusiasm!"),
            ]
        ),
        TrainingProgram(
            title: "Crate Training",
            description: "Make the crate a safe haven. Critical for potty training success.",
            icon: "house.fill",
            color: .blue,
            durationWeeks: 2,
            isPremium: false,
            lessons: [
                TrainingLesson(day: 1, title: "Introduce the Crate", duration: "15 min", instructions: "Place the crate in a common area with the door open. Toss treats inside. Let your puppy explore on their own — never push them in."),
                TrainingLesson(day: 2, title: "Feeding in the Crate", duration: "All day", instructions: "Feed all meals just inside the crate entrance. Gradually move the bowl further back over several feedings."),
                TrainingLesson(day: 3, title: "Closing the Door", duration: "Short sessions", instructions: "Once your puppy enters freely, close the door for 1-2 minutes while you stay nearby. Increase to 5 minutes. Never react to whining."),
            ]
        ),
        TrainingProgram(
            title: "Loose Leash Walking",
            description: "Walk without pulling — the skill every owner needs.",
            icon: "figure.walk",
            color: .orange,
            durationWeeks: 3,
            isPremium: true,
            lessons: [
                TrainingLesson(day: 1, title: "Equipment Introduction", duration: "10 min", instructions: "Let your puppy sniff and wear the harness or collar indoors before any walking. Pair putting on the equipment with treats."),
            ]
        ),
        TrainingProgram(
            title: "Recall (Come)",
            description: "The most important safety command — could save their life.",
            icon: "arrow.uturn.left.circle.fill",
            color: .red,
            durationWeeks: 2,
            isPremium: true,
            lessons: []
        ),
        TrainingProgram(
            title: "Advanced Tricks",
            description: "Spin, shake, roll over, play dead — impress everyone.",
            icon: "star.fill",
            color: .purple,
            durationWeeks: 4,
            isPremium: true,
            lessons: []
        ),
    ]
}

struct TrainingLesson: Identifiable {
    var id = UUID()
    var day: Int
    var title: String
    var duration: String
    var instructions: String
}

struct TrainingProgramCard: View {
    let program: TrainingProgram
    var isLocked: Bool
    var onLockedTap: (() -> Void)? = nil

    var body: some View {
        NavigationLink(destination: isLocked ? AnyView(EmptyView()) : AnyView(TrainingProgramDetailView(program: program))) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(program.color.opacity(0.15))
                        .frame(width: 50, height: 50)
                    Image(systemName: program.icon)
                        .font(.title3)
                        .foregroundColor(program.color)
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(program.title).font(.headline)
                        if program.isPremium {
                            Text("PREMIUM")
                                .font(.caption2.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Color.purple)
                                .cornerRadius(4)
                        }
                    }
                    Text(program.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                    Text("\(program.durationWeeks) week\(program.durationWeeks == 1 ? "" : "s")")
                        .font(.caption2)
                        .foregroundColor(program.color)
                }
                Spacer()
                Image(systemName: isLocked ? "lock.fill" : "chevron.right")
                    .foregroundColor(isLocked ? .secondary : Color(.systemGray3))
            }
            .padding(14)
            .background(Color(.systemBackground))
            .cornerRadius(14)
            .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(isLocked ? TapGesture().onEnded { onLockedTap?() } : nil)
    }
}

struct TrainingProgramDetailView: View {
    let program: TrainingProgram

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(program.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("Duration: \(program.durationWeeks) week\(program.durationWeeks == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(program.color)
                }
                .padding(.vertical, 4)
            }

            Section("Lessons") {
                ForEach(program.lessons) { lesson in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Day \(lesson.day): \(lesson.title)")
                                .font(.subheadline.bold())
                            Spacer()
                            Text(lesson.duration)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Text(lesson.instructions)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(program.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
