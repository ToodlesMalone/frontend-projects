import SwiftUI

struct OnboardingFlowView: View {
    @EnvironmentObject var puppyStore: PuppyStore
    @State private var currentPage = 0
    @State private var puppyName = ""
    @State private var puppyBreed = ""
    @State private var puppyBirthDate = Calendar.current.date(byAdding: .weekOfYear, value: -8, to: Date()) ?? Date()
    @State private var puppyGender: Puppy.Gender = .male
    @State private var puppyWeight: Double = 5.0
    @State private var selectedPhotoData: Data? = nil

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color("BrandYellow"), Color("BrandOrange")],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()

            VStack {
                // Progress dots
                HStack(spacing: 8) {
                    ForEach(0..<4) { i in
                        Circle()
                            .fill(i <= currentPage ? Color.white : Color.white.opacity(0.4))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.top, 20)

                TabView(selection: $currentPage) {
                    WelcomePage().tag(0)
                    PuppyNamePage(name: $puppyName, gender: $puppyGender).tag(1)
                    PuppyDetailPage(breed: $puppyBreed, birthDate: $puppyBirthDate, weight: $puppyWeight).tag(2)
                    ReadyPage(
                        puppyName: puppyName,
                        onFinish: finishOnboarding
                    ).tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentPage)

                // Next button
                if currentPage < 3 {
                    Button(action: { withAnimation { currentPage += 1 } }) {
                        Text(currentPage == 0 ? "Get Started" : "Next")
                            .font(.headline)
                            .foregroundColor(Color("BrandOrange"))
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white)
                            .cornerRadius(16)
                    }
                    .padding(.horizontal, 32)
                    .padding(.bottom, 40)
                    .disabled(currentPage == 1 && puppyName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .opacity(currentPage == 1 && puppyName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                }
            }
        }
    }

    private func finishOnboarding() {
        let puppy = Puppy(
            name: puppyName.isEmpty ? "Pup" : puppyName,
            breed: puppyBreed.isEmpty ? "Mixed Breed" : puppyBreed,
            birthDate: puppyBirthDate,
            photoData: selectedPhotoData,
            weightLbs: puppyWeight,
            gender: puppyGender
        )
        puppyStore.savePuppy(puppy)
    }
}

// MARK: - Page Views

struct WelcomePage: View {
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("🐶")
                .font(.system(size: 80))
            Text("Welcome to\nPuppyStart")
                .font(.system(size: 36, weight: .bold))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)
            Text("Your complete guide to raising a happy, healthy puppy — from day one.")
                .font(.body)
                .foregroundColor(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
            Spacer()
        }
    }
}

struct PuppyNamePage: View {
    @Binding var name: String
    @Binding var gender: Puppy.Gender

    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            Text("What's your\npuppy's name?")
                .font(.system(size: 32, weight: .bold))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)

            TextField("e.g. Bella, Max, Luna...", text: $name)
                .font(.title2)
                .padding()
                .background(Color.white)
                .cornerRadius(14)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 8) {
                Text("Gender")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                Picker("Gender", selection: $gender) {
                    ForEach(Puppy.Gender.allCases, id: \.self) { g in
                        Text(g.rawValue).tag(g)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 32)
                .background(Color.white.opacity(0.2))
            }

            Spacer()
            Spacer()
        }
    }
}

struct PuppyDetailPage: View {
    @Binding var breed: String
    @Binding var birthDate: Date
    @Binding var weight: Double

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                Spacer().frame(height: 20)
                Text("Tell us about\nyour pup")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Breed")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                    TextField("e.g. Golden Retriever, Labrador...", text: $breed)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(14)
                        .padding(.horizontal, 32)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Birthday")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                    DatePicker("Birthday", selection: $birthDate, in: ...Date(), displayedComponents: .date)
                        .datePickerStyle(.compact)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(14)
                        .padding(.horizontal, 32)
                        .labelsHidden()
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Current weight: \(String(format: "%.1f", weight)) lbs")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                    Slider(value: $weight, in: 1...30, step: 0.5)
                        .accentColor(.white)
                        .padding(.horizontal, 32)
                }

                Spacer().frame(height: 60)
            }
        }
    }
}

struct ReadyPage: View {
    let puppyName: String
    let onFinish: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("🎉")
                .font(.system(size: 80))
            Text("You're all set,\n\(puppyName.isEmpty ? "pup parent" : puppyName + "'s parent")!")
                .font(.system(size: 32, weight: .bold))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 12) {
                FeatureRow(icon: "checkmark.circle.fill", text: "Daily milestone tracking")
                FeatureRow(icon: "checkmark.circle.fill", text: "Feeding & potty logs")
                FeatureRow(icon: "checkmark.circle.fill", text: "Vaccination scheduler")
                FeatureRow(icon: "star.circle.fill", text: "AI puppy coach (Premium)")
                FeatureRow(icon: "star.circle.fill", text: "Expert training programs (Premium)")
            }
            .padding(.horizontal, 32)

            Button(action: onFinish) {
                Text("Meet \(puppyName.isEmpty ? "your pup" : puppyName)! 🐾")
                    .font(.headline)
                    .foregroundColor(Color("BrandOrange"))
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.white)
                    .cornerRadius(16)
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 40)

            Spacer()
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.white)
                .font(.title3)
            Text(text)
                .foregroundColor(.white)
                .font(.body)
            Spacer()
        }
    }
}
