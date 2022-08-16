import 'cross-fetch/polyfill'
import { FiatConnectClientImpl, createSiweConfig } from './fiat-connect-client'
import {
  FiatConnectClientConfig,
  SiweClientConfig,
  CookieJarType,
} from './types'
import fetchCookie from 'fetch-cookie'
import { SiweImpl } from './siwe-client'
import { Cookie } from 'tough-cookie'
export * from './types'

const fetchWithCookie = fetchCookie(fetch)

export class FiatConnectClient extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    const siweClient = new SiweClient(createSiweConfig(config), signingFunction)
    super(config, siweClient, fetchWithCookie)
  }
}

export class SiweClient extends SiweImpl {
  constructor(
    config: SiweClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetchWithCookie)
  }

  async getCookies(): Promise<CookieJarType> {
    const cookieRecord: CookieJarType = {}
    const setCookie = await Cookie.parse(
      this._loginHeader.get('set-cookie') || '',
    )
    if (setCookie) {
      cookieRecord[setCookie.key] = setCookie.value
    }
    return cookieRecord
  }
}
