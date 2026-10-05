// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-file-system
jest.mock(
  'expo-file-system',
  () => ({
    documentDirectory: '/mock/documents/',
    getInfoAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
  }),
  { virtual: true }
);

// Mock expo-file-system/legacy
jest.mock(
  'expo-file-system/legacy',
  () => ({
    documentDirectory: '/mock/documents/',
    getInfoAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
  }),
  { virtual: true }
);

// Mock @react-native-community/netinfo
jest.mock(
  '@react-native-community/netinfo',
  () => ({
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(),
  }),
  { virtual: true }
);

// react-native-reanimated: use the library's own jest support. The real module
// loads under jest now that the worklets babel plugin runs in tests (see
// babel.config.js); do not hand-roll a mock of it (habitcraft-ma03).
require('react-native-reanimated').setUpTests();

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }) => children,
  Swipeable: 'Swipeable',
  DrawerLayout: 'DrawerLayout',
  State: {},
  ScrollView: 'ScrollView',
  Slider: 'Slider',
  Switch: 'Switch',
  TextInput: 'TextInput',
  ToolbarAndroid: 'ToolbarAndroid',
  ViewPagerAndroid: 'ViewPagerAndroid',
  DrawerLayoutAndroid: 'DrawerLayoutAndroid',
  WebView: 'WebView',
  NativeViewGestureHandler: 'NativeViewGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  FlingGestureHandler: 'FlingGestureHandler',
  ForceTouchGestureHandler: 'ForceTouchGestureHandler',
  LongPressGestureHandler: 'LongPressGestureHandler',
  PanGestureHandler: 'PanGestureHandler',
  PinchGestureHandler: 'PinchGestureHandler',
  RotationGestureHandler: 'RotationGestureHandler',
  RawButton: 'RawButton',
  BaseButton: 'BaseButton',
  RectButton: 'RectButton',
  BorderlessButton: 'BorderlessButton',
  TouchableHighlight: 'TouchableHighlight',
  TouchableNativeFeedback: 'TouchableNativeFeedback',
  TouchableOpacity: 'TouchableOpacity',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  Directions: {},
}));

// Mock expo-splash-screen
// The real module reaches for its native half at import, which jest does not
// have. Node's own randomUUID stands in, so ids stay unique and well-formed in
// any test that does not pin them itself (habitcraft-bqhe.23).
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => require('crypto').randomUUID()),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
