# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.3.5](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.3.4...v0.3.5) (2022-08-03)


### Bug Fixes

* **deps:** update dependency @fiatconnect/fiatconnect-types to v7 ([#53](https://github.com/fiatconnect/fiatconnect-sdk/issues/53)) ([6a6063b](https://github.com/fiatconnect/fiatconnect-sdk/commit/6a6063bd2cce60a5ee7bb0ff4ec67d0cefd4f28b))

### [0.3.4](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.3.3...v0.3.4) (2022-08-03)


### Bug Fixes

* **deps:** update dependency @fiatconnect/fiatconnect-types to ^6.1.0 ([#41](https://github.com/fiatconnect/fiatconnect-sdk/issues/41)) ([14fd9e4](https://github.com/fiatconnect/fiatconnect-sdk/commit/14fd9e4752bfeebb5a975a2ab1788a0a7d8c3244))
* **quote:** Fix header in post request ([#38](https://github.com/fiatconnect/fiatconnect-sdk/issues/38)) ([0f07308](https://github.com/fiatconnect/fiatconnect-sdk/commit/0f07308748cf8f1b5cb9b7e6d1858df0c7d3a5ba))

### [0.3.3](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.3.2...v0.3.3) (2022-07-15)


### Features

* **client:** handle cookies based on platform ([#36](https://github.com/fiatconnect/fiatconnect-sdk/issues/36)) ([fd0b277](https://github.com/fiatconnect/fiatconnect-sdk/commit/fd0b2774e1a655b5c23441b46ff25843cf4ad240))

### [0.3.2](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.3.1...v0.3.2) (2022-06-27)

### Features

* **createQuoteIn/Out:** renamed getQuoteIn/Out to createQuoteIn/Out and switched to POST to keep in sync with spec ([733e8fd](https://github.com/fiatconnect/fiatconnect-sdk/commit/733e8fd874dc805a88d96d07472bfdf999ca4c6b))

### Bug Fixes

* **kyc status:** should be GET /kyc/:kycSchema/status (was: GET /kyc/:kycSchema) ([733e8fd](https://github.com/fiatconnect/fiatconnect-sdk/commit/733e8fd874dc805a88d96d07472bfdf999ca4c6b))


### [0.3.1](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.3.0...v0.3.1) (2022-06-21)


### Features

* **accounts:** update add params to match with spec ([#32](https://github.com/fiatconnect/fiatconnect-sdk/issues/32)) ([1db193d](https://github.com/fiatconnect/fiatconnect-sdk/commit/1db193d217ab371b2507df0f0bee3deab222ea3f))
* **sessions:** Allow custom issued-at, set reasonable defaults ([#30](https://github.com/fiatconnect/fiatconnect-sdk/issues/30)) ([a90a0ee](https://github.com/fiatconnect/fiatconnect-sdk/commit/a90a0eec9dddfa56a306a183960c32817f677599))

### [0.3.0](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.2.3...v0.3.0) (2022-06-15)


### Features

* **fiat account types:** Version bumped @fiatconnect/fiatconnect-types and updated FiatAccountSchemaData to include the latest fiat account types
* **drop unused fields:** from FiatConnectClient

### [0.2.3](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.2.2...v0.2.3) (2022-06-15)


### Bug Fixes

* **siwe:** Convert account address to checksum address ([#26](https://github.com/fiatconnect/fiatconnect-sdk/issues/26)) ([0342df0](https://github.com/fiatconnect/fiatconnect-sdk/commit/0342df03c4ad7aa0493275eec7d2bb87823aaeb5))

### [0.2.2](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.2.1...v0.2.2) (2022-06-09)


### Features

* **result:** Replace Result implementation, simplify errors ([#24](https://github.com/fiatconnect/fiatconnect-sdk/issues/24)) ([0b1a154](https://github.com/fiatconnect/fiatconnect-sdk/commit/0b1a1549f0e7a895367c17683ceb62e4f5f49680))

### [0.2.1](https://github.com/fiatconnect/fiatconnect-sdk/compare/v0.2.0...v0.2.1) (2022-05-23)


### Features

* **login:** Add isLoggedIn, minor fixes ([#19](https://github.com/fiatconnect/fiatconnect-sdk/issues/19)) ([a3b7714](https://github.com/fiatconnect/fiatconnect-sdk/commit/a3b7714c36d316877427db35cee33361051f8d56))

## 0.2.0 (2022-05-16)

Initial release
