# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.2.0 (2022-05-12)


### ⚠ BREAKING CHANGES

* creating transfer now requires quoteId parameter

other changes:

cREAL added as crypto currency
guaranteedUntil field is now guaranteed on quote responses
quoteId field is now guaranteed on quote responses
added AccountNumber, removed MockCheckingAccount fiat account type
* added name, icon as required params for creating a FiatConnectClient instance

cc https://app.zenhub.com/workspaces/acquisition-squad-sprint-board-6010683afabec1001a090887/issues/valora-inc/wallet/1979

### Features

* **auth:** add support for client API keys ([#13](https://github.com/fiatconnect/fiatconnect-sdk/issues/13)) ([b0a7c0e](https://github.com/fiatconnect/fiatconnect-sdk/commit/b0a7c0e2464aafef980bc558495f13c4277cb738))
* **auth:** implement siwe ([#10](https://github.com/fiatconnect/fiatconnect-sdk/issues/10)) ([6b8f1d3](https://github.com/fiatconnect/fiatconnect-sdk/commit/6b8f1d385b3e099ba9124f5446a7fc8b6dd1db7d))
* **auth:** update login to always create a session ([#12](https://github.com/fiatconnect/fiatconnect-sdk/issues/12)) ([8f552d7](https://github.com/fiatconnect/fiatconnect-sdk/commit/8f552d7f668d967989e57f35d9e8a0a7ac00f060))
* **clock:** Add clock support to SDK ([#11](https://github.com/fiatconnect/fiatconnect-sdk/issues/11)) ([3ad99a1](https://github.com/fiatconnect/fiatconnect-sdk/commit/3ad99a1c177df3dd49ca2aa1ff2bef9d48dcf48d))


* added provider name and icon url to config ([#7](https://github.com/fiatconnect/fiatconnect-sdk/issues/7)) ([ec3e1f2](https://github.com/fiatconnect/fiatconnect-sdk/commit/ec3e1f2cc72e4fa8ea654cf2f4c603fba5b62a77))
* updated types ([#8](https://github.com/fiatconnect/fiatconnect-sdk/issues/8)) ([4593436](https://github.com/fiatconnect/fiatconnect-sdk/commit/4593436cfa3437cc089d02f509ac6faa0cf60469))
