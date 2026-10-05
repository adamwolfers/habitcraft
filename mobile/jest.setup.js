// The jest-expo preset (jest.config.js) already mocks the native half of every
// Expo module and of common third-party ones such as netinfo, so expo-secure-store,
// expo-file-system and @react-native-community/netinfo need no global mock here.
// Tests that assert on those modules mock them locally (habitcraft-yh5f).
// Only add a mock below when the preset's stub is not enough, and say why.

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

// expo-crypto: the preset's stub of the native half does not produce real ids.
// Node's own randomUUID stands in, so ids stay unique and well-formed in any
// test that does not pin them itself (habitcraft-bqhe.23).
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => require('crypto').randomUUID()),
}));
