/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      // Which jest config runs is a variable for the same reason the device
      // names below are: so CI can select the smoke subset without editing
      // this file. Detox has no CLI flag to override the runner's config, and
      // it re-invokes jest through a shell, so a --testNamePattern on the
      // command line is a shell-quoting hazard (habitcraft-bqhe.17). Set
      // DETOX_JEST_CONFIG=e2e/jest.smoke.config.js for the 9-case CI gate
      // (habitcraft-bqhe.12); unset runs all 37.
      config: process.env.DETOX_JEST_CONFIG || 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Debug-iphonesimulator/HabitCraft.app',
      build:
        'xcodebuild -workspace ios/HabitCraft.xcworkspace -scheme HabitCraft -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Release-iphonesimulator/HabitCraft.app',
      build:
        'xcodebuild -workspace ios/HabitCraft.xcworkspace -scheme HabitCraft -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build:
        'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [3010],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  // Device names are overridable because a hard-coded model is guaranteed to
  // rot: this file shipped 'iPhone 15' and 'Pixel_7_API_34', neither of which
  // existed on the machine that first ran the suite (habitcraft-bqhe.2). CI
  // pins its own via these variables rather than editing the file.
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: process.env.DETOX_IOS_DEVICE || 'iPhone 17',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_7_API_34',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
