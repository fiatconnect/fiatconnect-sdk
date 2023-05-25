import 'cross-fetch/polyfill'
import fetchCookie from 'fetch-cookie'
import { Cookie } from 'tough-cookie'
import { FiatConnectClientImpl, createSiweConfig } from './fiat-connect-client'
import { SiweImpl } from './siwe-client'
import { FiatConnectClientConfig, SiweClientConfig } from './types'
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

  async _extractCookies(headers?: Headers): Promise<void> {
    const cookieRecord: Record<string, string> = {}
    // previously

    let headerSetCookies: Array<string> = []

    try {
      // returns headers.raw is not a function while running the sdk on a repl
      headerSetCookies = (headers as any)?.raw()['set-cookie'] as Array<string>
    } catch {
      //  returns headers.get is not a function while running test cases
      // according to the type definitions, .get happens to be the correct method to extract the cookie headers
      headerSetCookies = headers
        ?.get('set-cookie')
        ?.split(';')
        ?.map((headerValue) => String(headerValue).trim()) as Array<string>
    }

    if (headerSetCookies) {
      headerSetCookies.forEach(async (cookieString: string) => {
        const setCookie = Cookie.parse(cookieString)
        if (setCookie) {
          cookieRecord[setCookie.key] = setCookie.value
        }
      })
    }

    this._cookieJar = cookieRecord
  }
}
