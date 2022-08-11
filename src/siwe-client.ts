import { AuthRequestBody } from '@fiatconnect/fiatconnect-types'
import { ethers } from 'ethers'
import { generateNonce, SiweMessage } from 'siwe'
import { SiweClient, SiweClientConfig, SiweLoginParams } from './types'

export class SiweImpl implements SiweClient {
  config: SiweClientConfig
  signingFunction: (message: string) => Promise<string>
  fetchImpl: typeof fetch
  _sessionExpiry?: Date

  constructor(
    config: SiweClientConfig,
    signingFunction: (message: string) => Promise<string>,
    fetchImpl: typeof fetch,
  ) {
    this.config = config
    this.signingFunction = signingFunction
    this.fetchImpl = fetchImpl
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
}
