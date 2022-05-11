# fiatconnect-sdk

A (WIP) Typescript helper libary for wallets to integrate with FiatConnect compliant APIs.

## Running tests

```console
yarn test
```

## Contributing

We welcome contributions in the form of Issues and PRs. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Publishing

- Request access to our [NPM organization](https://www.npmjs.com/org/fiatconnect) on [Valora Discord](https://discord.gg/rwxxsZjJbd)
- Make sure you are on the latest version of branch `main`
- Check out a release branch
- Run `yarn prepublish && yarn release`
- Add release notes to `CHANGELOG.md`
- Once code review has taken place:
  - Merge your branch
  - Run `git tag vX.Y.Z && git push origin vX.Y.Z` to push your tag (where X.Y.Z is the version you are trying to publish)
  - [Create a release](https://github.com/fiatconnect/fiatconnect-sdk/releases) with the new tag
  - Run `npm publish --public`
