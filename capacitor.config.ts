export interface CapacitorAppConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: 'http' | 'https';
    iosScheme?: string;
    cleartext?: boolean;
  };
  ios?: {
    contentInset?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
    limitsNavigationsToAppBoundDomains?: boolean;
    preferredContentMode?: 'recommended' | 'mobile' | 'desktop';
  };
  android?: {
    allowMixedContent?: boolean;
    captureInput?: boolean;
    webContentsDebuggingEnabled?: boolean;
  };
  plugins?: {
    SplashScreen?: {
      launchAutoHide?: boolean;
      backgroundColor?: string;
      showSpinner?: boolean;
    };
    StatusBar?: {
      style?: 'DARK' | 'LIGHT' | 'DEFAULT';
      backgroundColor?: string;
    };
    Keyboard?: {
      resize?: 'body' | 'ionic' | 'native' | 'none';
      resizeOnFullScreen?: boolean;
    };
    LocalNotifications?: {
      smallIcon?: string;
      iconColor?: string;
    };
    PushNotifications?: {
      presentationOptions?: Array<'badge' | 'sound' | 'alert'>;
    };
  };
}

const config: CapacitorAppConfig = {
  appId: 'com.neuronmind.assistant',
  appName: 'Neuron Mind',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'recommended',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0B1B3B',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B1B3B',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_neuron_mind',
      iconColor: '#102A5C',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
