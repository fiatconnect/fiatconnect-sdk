# fiatconnect-sdk

A lightweight Typescript helper library for wallets or dapps to integrate with FiatConnect compliant APIs.

## Basic usage

To begin, install the library from your project:
```console
yarn add @fiatconnect/fiatconnect-sdk
```

Next, initialize a `FiatConnectClient` wherever you need to access a FiatConnect API in your codebase. See examples in
the [Valora wallet](https://github.com/valora-inc/wallet/blob/61cb017439c7e606d6c09d6a276584d15a857968/src/fiatconnect/clients.ts#L34) 
and [FiatConnect validation tests](https://github.com/fiatconnect/validate/blob/main/validations/kyc.test.ts#L18).

From there, you can access any FiatConnect endpoint by invoking a method on the `FiatConnectClient` instance. There is 
a convenient example of a full transfer in [this validation test](https://github.com/fiatconnect/validate/blob/63995bd10c160c0ed7a82a7a4c505ae5a9743246/validations/transfer.test.ts#L50).

### Authenticated endpoints
Note that some FiatConnect endpoints require authentication before they can be accessed. You can read up on FiatConnect 
authentication [here](https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#331-sign-in-with-ethereum).

The FiatConnect SDK handles authentication by taking a `signingFunction` as a parameter in the `FiatConnectClient` 
constructor. The `FiatConnectClient` instance uses the signing function to sign a SIWE message and log in with a 
FiatConnect provider when:
- the `login` method is invoked explicitly
- any method for an endpoint that requires authentication is invoked (and the user does not already have a valid session)

Wallets may or may not wish to require a PIN every time a SIWE message is signed, or just some of the time. They may implement 
whatever preference they have by writing the `signingFunction` accordingly.

### Accessing multiple FiatConnect providers
In most cases, clients will wish to integrate with multiple FiatConnect providers. However, it is worth noting that the 
`FiatConnectClient` class deals with only a single provider. This allows for more convenient separation of session 
cookies and provider-specific configuration data (base URL, etc.). 

For an example of how to manage multiple 
FiatConnect providers in your codebase using the FiatConnect SDK, you may refer to the 
[Valora wallet](https://github.com/valora-inc/wallet/blob/61cb017439c7e606d6c09d6a276584d15a857968/src/fiatconnect/clients.ts#L11),
 which stores an object in memory mapping provider ID's to FiatConnectClient instances. Many similar possibilities exist.

## Running tests

```console
yarn test
```

## Contributing

We welcome contributions in the form of Issues and PRs. See [CONTRIBUTING.md](CONTRIBUTING.md). If you have ideas for 
FiatConnect SDK that you'd like to discuss with other developers, you may contact us on the 
[FiatConnect Discord](https://discord.gg/yR5hFEVcRz). 

### Publishing

- Requires access to our [NPM organization](https://www.npmjs.com/org/fiatconnect). Ask on [FiatConnect Discord](https://discord.gg/yR5hFEVcRz)
- Make sure you are on the latest version of branch `main`
- Check out a release branch
- Run `yarn prepublish && yarn release`
- Add release notes to `CHANGELOG.md`
- Once code review has taken place:
  - Merge your branch
  - Run `git tag vX.Y.Z && git push origin vX.Y.Z` to push your tag (where X.Y.Z is the version you are trying to publish)
  - [Create a release](https://github.com/fiatconnect/fiatconnect-sdk/releases) with the new tag
  - Run `npm publish --public`
