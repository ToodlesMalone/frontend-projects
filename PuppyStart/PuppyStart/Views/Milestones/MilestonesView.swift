import SwiftUI

struct MilestonesView: View {
    @EnvironmentObject var puppyStore: PuppyStore

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(Milestone.allMilestones.enumerated()), id: \.element.id) { index, milestone in
                        MilestoneRow(
                            milestone: milestone,
                            isReached: (puppyStore.puppy?.ageInWeeks ?? 0) >= milestone.weekNumber,
                            isCurrent: puppyStore.currentMilestone?.id == milestone.id,
                            isLast: index == Milestone.allMilestones.count - 1
                        )
                    }
                }
                .padding(16)
            }
            .navigationTitle("Milestones")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

struct MilestoneRow: View {
    let milestone: Milestone
    let isReached: Bool
    let isCurrent: Bool
    let isLast: Bool
    @State private var expanded = false

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Timeline column
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(isReached ? Color("BrandOrange") : Color(.systemGray5))
                        .frame(width: 32, height: 32)
                    if isReached {
                        Image(systemName: isCurrent ? "pawprint.fill" : "checkmark")
                            .font(.caption.bold())
                            .foregroundColor(.white)
                    } else {
                        Text("\(milestone.weekNumber)")
                            .font(.caption2.bold())
                            .foregroundColor(.secondary)
                    }
                }
                if !isLast {
                    Rectangle()
                        .fill(isReached ? Color("BrandOrange").opacity(0.4) : Color(.systemGray5))
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 32)

            // Content
            VStack(alignment: .leading, spacing: 8) {
                Button(action: { withAnimation { expanded.toggle() } }) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Week \(milestone.weekNumber)")
                                .font(.caption)
                                .foregroundColor(isReached ? Color("BrandOrange") : .secondary)
                            if isCurrent {
                                Text("NOW")
                                    .font(.caption2.bold())
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color("BrandOrange"))
                                    .cornerRadius(4)
                            }
                        }
                        Text(milestone.title)
                            .font(.headline)
                            .foregroundColor(isReached ? .primary : .secondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                .buttonStyle(.plain)

                if expanded || isCurrent {
                    Text(milestone.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(milestone.tips, id: \.self) { tip in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "pawprint.fill")
                                    .font(.caption)
                                    .foregroundColor(Color("BrandOrange"))
                                    .padding(.top, 2)
                                Text(tip)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
    }
}
