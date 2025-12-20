// File: config-overrides.js
const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    "buffer": require.resolve("buffer/"),
    "stream": require.resolve("stream-browserify"),
    "crypto": require.resolve("crypto-browserify"),
    "assert": require.resolve("assert"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify"),
    "url": require.resolve("url"),
  });
  config.resolve.fallback = fallback;

  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ]);

  // Fix for some modules using fully specified imports
  config.module.rules.push({
    test: /\.m?js/,
    resolve: { fullySpecified: false },
  });

  return config;
};
