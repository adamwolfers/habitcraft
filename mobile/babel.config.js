module.exports = function (api) {
  api.cache(true);

  const plugins = [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@': './src',
          '@/components': './src/components',
          '@/screens': './src/screens',
          '@/hooks': './src/hooks',
          '@/lib': './src/lib',
          '@/context': './src/context',
          '@/navigation': './src/navigation',
          '@/theme': './src/theme',
          '@/types': './src/types',
        },
      },
    ],
  ];

  // Kept on under jest too: without it 'worklet' functions are never marked, and
  // react-native-worklets throws WorkletsError at import (habitcraft-ma03).
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // The plugin is added explicitly above; don't let the preset add it twice.
          reanimated: false,
        },
      ],
    ],
    plugins,
  };
};
