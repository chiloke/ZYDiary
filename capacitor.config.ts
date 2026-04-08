import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zydiary.mobile',
  appName: 'ZY Diary',
  webDir: 'mobile-web',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#efe9df',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#efe9df',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#efe9df'
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#234c3a'
    }
  }
};

export default config;
