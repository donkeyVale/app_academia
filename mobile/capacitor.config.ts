import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nativatech.agendo',
  appName: 'Agendo',
  webDir: 'www',
  server: {
    url: 'https://capacitor.nativatech.com.py',
    cleartext: false,
    allowNavigation: ['capacitor.nativatech.com.py']
  }
};

export default config;
