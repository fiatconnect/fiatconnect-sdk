import 'cross-fetch/polyfill'
import { FiatConnectClientImpl } from './fiat-connect-client'
import { FiatConnectClientConfig } from './types'

export class FiatConnectClient extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetch)
  }
}
