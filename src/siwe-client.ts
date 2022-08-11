import { AuthRequestBody } from '@fiatconnect/fiatconnect-types'
import { ethers } from 'ethers'
import { generateNonce, SiweMessage } from 'siwe'
import { SiweClient, SiweClientConfig, LoginParams } from './types'

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

  async login(params?: LoginParams): Promise<void> {
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
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // On a non 200 response, the response should be a JSON including an error field.
      const responseText = await response.text()
      throw new Error(`Received non 200 response on login: ${responseText}`)
    }

    this._sessionExpiry = expirationTime
  }

  isLoggedIn(): boolean {
    return !!(this._sessionExpiry && this._sessionExpiry > new Date())
  }

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
