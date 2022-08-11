import 'cross-fetch/polyfill'
import { FiatConnectClientImpl } from './fiat-connect-client'
import { FiatConnectClientConfig, SiweClientConfig } from './types'
import fetchCookie from 'fetch-cookie'
import { SiweImpl } from './siwe-client'
export * from './types'

export class FiatConnectClient extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetchCookie(fetch))
  }
}

export class SiweClient extends SiweImpl {
  constructor(
    config: SiweClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetchCookie(fetch))
  }
}
