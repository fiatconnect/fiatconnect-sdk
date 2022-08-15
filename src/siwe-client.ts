import { AuthRequestBody, ClockResponse } from '@fiatconnect/fiatconnect-types'
import { ethers } from 'ethers'
import { generateNonce, SiweMessage } from 'siwe'
import { CookieJar, MemoryCookieStore } from 'tough-cookie'
import {
  ClockDiffParams,
  ClockDiffResult,
  SiweApiClient,
  SiweClientConfig,
  SiweLoginParams,
} from './types'

export class SiweImpl implements SiweApiClient {
  config: SiweClientConfig
  signingFunction: (message: string) => Promise<string>
  fetchImpl: typeof fetch
  _sessionExpiry?: Date
  cookieJar: CookieJar

  constructor(
    config: SiweClientConfig,
    signingFunction: (message: string) => Promise<string>,
    fetchImpl: typeof fetch,
  ) {
    this.config = config
    this.signingFunction = signingFunction
    this.fetchImpl = fetchImpl
    this.cookieJar = new CookieJar(new MemoryCookieStore(), {
      rejectPublicSuffixes: false,
    })
  }

  /**
   * Logs in with the SIWE compliant API and initializes a session.
   *
   * @param {SiweLoginParams} params optional object containing params used to log in
   */
  async login(params?: SiweLoginParams): Promise<void> {
    // Prefer param issued-at > client-based issued-at
    const issuedAt = params?.issuedAt || new Date()
    const expirationTime = new Date(
      issuedAt.getTime() + this.config.sessionDurationMs,
    )
    const siweMessage = new SiweMessage({
      domain: new URL(this.config.loginUrl).hostname,
      // Some SIWE validators compare this against the checksummed signing address,
      // and thus will always fail if this address is not checksummed. This coerces
      // non-checksummed addresses to be checksummed.
      address: ethers.utils.getAddress(this.config.accountAddress),
      statement: this.config.statement,
      uri: this.config.loginUrl,
      version: this.config.version,
      chainId: this.config.chainId,
      nonce: generateNonce(),
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
    })
    const message = siweMessage.prepareMessage()
    const body: AuthRequestBody = {
      message,
      signature: await this.signingFunction(message),
    }

    const response = await this.fetchImpl(this.config.loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...params?.headers,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // On a non 200 response, the response should be a JSON including an error field.
      const responseText = await response.text()
      throw new Error(`Received error response on login: ${responseText}`)
    }

    const headerSetCookie = (response.headers as any).raw()[
      'set-cookie'
    ] as Array<string>

    if (headerSetCookie) {
      await Promise.all(
        headerSetCookie.map(async (cookie: string) => {
          await this.cookieJar.setCookie(cookie, this.config.loginUrl)
        }),
      )
    }

    this._sessionExpiry = expirationTime
  }

  /**
   * Checks if a logged in session exists.
   *
   * @returns true if an unexpired session exists, else false
   */
  isLoggedIn(): boolean {
    return !!(this._sessionExpiry && this._sessionExpiry > new Date())
  }

  /**
   * Invokes clock endpoint and returns the result.
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#321-get-clock
   *
   * @returns an object containing a single time field with server time in ISO
   * 8601 datetime string.
   */
  async getClock(): Promise<ClockResponse> {
    const response = await this.fetchImpl(`${this.config.clockUrl}`)
    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(
        `Received error response from clock endpoint: ${responseText}`,
      )
    }
    return response.json()
  }

  /**
   * Returns an approximation of the current server time, taking into account clock differences
   * between client and server. Returns the earliest possible server time based on the max error
   * of the clock diff between client and server, to ensure that sessions created using this time
   * are not issued in the future with respect to the server clock.
   */
  async getServerTimeApprox(): Promise<Date> {
    const clockDiffResponse = await this.getClockDiffApprox()
    return new Date(
      Date.now() + clockDiffResponse.diff - clockDiffResponse.maxError,
    )
  }

  /**
   * https://en.wikipedia.org/wiki/Network_Time_Protocol#Clock_synchronization_algorithm
   *
   * Returns the calculated difference between the client and server clocks as a number of milliseconds.
   * Positive values mean the server's clock is ahead of the client's.
   * Also returns the maximum error of the calculated difference.
   */
  _calculateClockDiff({ t0, t1, t2, t3 }: ClockDiffParams): ClockDiffResult {
    return {
      diff: Math.floor((t1 - t0 + (t2 - t3)) / 2),
      maxError: Math.floor((t3 - t0) / 2),
    }
  }

  /**
   * Convenience method to calculate the approximate difference between server and client clocks.
   */
  async getClockDiffApprox(): Promise<ClockDiffResult> {
    const t0 = Date.now()
    const clockResponse = await this.getClock()
    const t3 = Date.now()

    const t1 = new Date(clockResponse.time).getTime()
    // We can assume that t1 and t2 are sufficiently close to each other
    const t2 = t1
    return this._calculateClockDiff({ t0, t1, t2, t3 })
  }

  /**
   * A wrapper around fetch that ensures a session exists before making the
   * fetch request
   *
   * @param input the fetch input
   * @param init the fetch options
   * @returns the fetch response
   */
  async fetch(
    input: URL | RequestInfo,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    if (!this.isLoggedIn()) {
      await this.login()
    }
    return this.fetchImpl(input, init)
  }

  getCookies(): Promise<string> {
    return this.cookieJar.getCookieString(this.config.loginUrl)
  }
}
