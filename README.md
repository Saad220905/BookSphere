# BookSphere 📚

BookSphere is a comprehensive social platform for book lovers to share video reviews, join book clubs, and connect with fellow readers. Built with React Native, Expo, and Firebase.

## ✨ Features

### 📖 PDF book reader & page comments
- Users can view and write comments on every page
- Like, and share comments
- Sentiment analysis to report if the comment is positive, negative or neutral

### ♣️ Book Clubs
- Create and join book clubs
- Real-time discussions and chat
- Member management and invitations
- Club activity tracking

### 🔍 Search & Discovery
- Advanced search across users, clubs, and books
- Book recommendations
- Trending content and Feed page (coming soon)

### 👤 User Profiles
- Customizable user profiles
- User-generated content showcase
- Social connections

### 📱 Modern UI/UX
- Beautiful, responsive design
- Smooth animations and transitions
- Intuitive navigation

## 🚀 Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: React Context + Hooks
- **UI Components**: Custom components with consistent theming
- **Error Handling**: Comprehensive error management system

## 📋 Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Firebase account
- iOS Simulator (for iOS development) or Android Emulator (for Android development)

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Saad220905/BookSphere.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file with your Firebase configuration:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

# App Configuration
NODE_ENV=development
```

### 4. Firebase Setup

1. Create a new Firebase project
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Enable Storage
5. Set up security rules for Firestore and Storage

### 5. Run the App

```bash
# Start the development server
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

## 🏗️ Project Structure

```
booknest/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   ├── clubs/             # Club-related screens
│   ├── create/            # Content creation screens
│   ├── discover/          # Discovery and search screens
│   └── profile/           # User profile screens
├── assets/               # Static assets (like app icon)
├── components/            # Reusable UI components
│   └── ...               # Feature-specific components
├── config/               # Configuration files
├── constants/            # App constants and themes
├── functions/             # Firebase runtime functions
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

## 🧪 Testing

```bash
# Run TypeScript type checking
npx tsc --noEmit

# Run ESLint
npx expo lint

# Check for security vulnerabilities
npm audit

# Run tests to ensure dependency compatibility
npx expo-doctor
```

## 📱 Building for Production

### iOS
```bash
npx expo build:ios
```

### Android
```bash
npx expo build:android
```

### Web
```bash
npx expo build:web
```

## 🚀 Deployment

### App Store / Google Play
1. Build the app using Expo EAS Build
2. Submit to respective app stores
3. Configure Firebase for production