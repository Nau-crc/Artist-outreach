module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react|react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@artist-outreach/.*|nativewind|react-native-css-interop)',
  ],
}
