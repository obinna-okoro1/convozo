// Karma configuration for Convozo unit tests
// Used by `ng test` via @angular/build:unit-test with runner: 'karma'

module.exports = function (config) {
  config.set({
    basePath: '',

    // Jasmine is the assertion/test framework; Angular CLI injects compiled files
    frameworks: ['jasmine'],

    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],

    client: {
      jasmine: {
        // Run tests in a random order to catch order dependencies
        random: true,
        // Uncomment to set a fixed seed: seed: 1234,
      },
      // Keep the Jasmine HTML runner output visible in the browser
      clearContext: false,
    },

    jasmineHtmlReporter: {
      // Suppress duplicate stack traces in reporter output
      suppressAll: true,
    },

    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/convozo-app'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' },
      ],
    },

    reporters: ['progress', 'kjhtml'],

    // Web server port
    port: 9876,

    // Enable colours in the output (reporters and logs)
    colors: true,

    // Possible values: config.LOG_DISABLE || config.LOG_ERROR ||
    //                  config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // Enable file watching & auto re-run tests on change
    autoWatch: true,

    // Start these browsers
    browsers: ['ChromeHeadless'],

    // Custom launcher for CI environments (no sandbox)
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu'],
      },
    },

    // Run once and exit (false = watch mode for development)
    singleRun: false,

    restartOnFileChange: true,
  });
};
