// Mock manual pro Jest (node_modules/react-native-config/index.js usa `export`
// nativo sem transpilar, Jest não consegue parsear direto) — mocks em
// __mocks__/<nome-do-pacote>.js na raiz são aplicados automaticamente pro
// pacote de node_modules correspondente, sem precisar de jest.mock() em
// cada teste.
export default {
  APP_WEB_URL: 'http://10.0.2.2:5173',
  API_BASE_URL: 'http://10.0.2.2:8000',
  GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: 'ios-client-id.apps.googleusercontent.com',
  PURCHASES_MODE: 'fake',
  REVENUECAT_ANDROID_API_KEY: '',
  REVENUECAT_IOS_API_KEY: '',
};
