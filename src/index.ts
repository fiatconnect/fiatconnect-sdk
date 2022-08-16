import 'cross-fetch/polyfill'
import { FiatConnectClientImpl, createSiweConfig } from './fiat-connect-client'
import { SiweImpl } from './siwe-client'
import { FiatConnectClientConfig, SiweClientConfig } from './types'
export * from './types'

export class FiatConnectClient extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    const siweClient = new SiweClient(createSiweConfig(config), signingFunction)
    super(config, siweClient, fetch)
  }
}

export class SiweClient extends SiweImpl {
  constructor(
    config: SiweClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetch)
  }
}
