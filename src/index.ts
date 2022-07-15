import { FiatConnectClientImpl } from './fiat-connect-client'
import { FiatConnectClientConfig } from './types'
import fetch from 'cross-fetch'
export * from './types'

export class FiatConnectClient extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetch)
  }
}
