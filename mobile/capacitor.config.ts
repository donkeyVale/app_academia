import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nativatech.agendo',
  appName: 'Agendo',
  webDir: 'www',
  server: {
    url: 'https://agendo.nativatech.com.py',
    cleartext: false,
    allowNavigation: ['agendo.nativatech.com.py']
  }
};

export default config;
