import type {
  GoogleIdentityProvider,
  GoogleProfile,
} from '../../application/ports/googleIdentityProvider'

export function createFakeGoogleIdentityProvider(profile: GoogleProfile): GoogleIdentityProvider {
  return {
    buildAuthUrl(state) {
      return `https://fake-google-auth.example.com/authorize?state=${state}`
    },
    async exchangeCode() {
      return profile
    },
    async verifyIdToken() {
      return profile
    },
  }
}
