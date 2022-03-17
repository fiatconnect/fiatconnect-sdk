module.exports = {
    "watchman": false,
    "moduleFileExtensions": [
      "ts",
      "js"
    ],
    "transform": {
      "^.+\\.(ts)$": "ts-jest"
    },
    "testPathIgnorePatterns": [
      "dist"
    ],
    "setupFiles": [
        "./setupJest.js"
    ]
  }