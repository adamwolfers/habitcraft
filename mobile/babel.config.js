module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test';

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

  // Only include reanimated plugin in non-test environments
  if (!isTest) {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Disable reanimated plugin in test environment (babel-preset-expo loads it internally)
          reanimated: !isTest,
        },
      ],
    ],
    plugins,
  };
};
