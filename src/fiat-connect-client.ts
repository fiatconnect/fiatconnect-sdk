import {
  AuthRequestBody,
  DeleteFiatAccountRequestParams,
  GetFiatAccountsResponse,
  KycRequestParams,
  KycStatusResponse,
  Network,
  PostFiatAccountRequestBody,
  PostFiatAccountResponse,
  QuoteErrorResponse,
  QuoteRequestBody,
  QuoteResponse,
  TransferResponse,
  TransferStatusRequestParams,
  TransferStatusResponse,
  ClockResponse,
  FiatAccountSchema,
  KycSchema,
} from '@fiatconnect/fiatconnect-types'
import fetch from 'cross-fetch'
import { generateNonce, SiweMessage } from 'siwe'
import { Result } from '@badrap/result'
import {
  AddKycParams,
  ResponseError,
  FiatConnectApiClient,
  FiatConnectClientConfig,
  TransferRequestParams,
  ClockDiffParams,
  ClockDiffResult,
  LoginParams,
} from './types'
import { ethers } from 'ethers'
import { Cookie, CookieJar, MemoryCookieStore } from 'tough-cookie'

const NETWORK_CHAIN_IDS = {
  [Network.Alfajores]: 44787,
  [Network.Mainnet]: 42220,
}
const SESSION_DURATION_MS = 14400000 // 4 hours

export class FiatConnectClientImpl implements FiatConnectApiClient {
  config: FiatConnectClientConfig
  signingFunction: (message: string) => Promise<string>
  _sessionExpiry?: Date
  fetchImpl: typeof fetch
  cookieJar: CookieJar

  constructor(
    config: FiatConnectClientConfig,
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

  _getAuthHeader() {
    if (this.config.apiKey) {
      return { Authorization: `Bearer ${this.config.apiKey}` }
    }
  }

  async _ensureLogin() {
    if (this.isLoggedIn()) {
      return
    }
    const loginResult = await this.login()
    if (loginResult.isErr) {
      throw loginResult.error
    }
  }

  /**
   * Checks if a logged in session exists with the provider.
   *
   * @returns true if an unexpired session exists with the provider, else false
   */
  isLoggedIn(): boolean {
    return !!(this._sessionExpiry && this._sessionExpiry > new Date())
  }

  /**
   * Logs in with the provider and initializes a session.
   *
   * @param {LoginParams} params optional object containing params used to log in
   * @returns a Promise resolving to the literal string 'success' on a
   * successful login or an Error response.
   */
  async login(params?: LoginParams): Promise<Result<'success', ResponseError>> {
    try {
      // Prefer param issued-at > diff-based issued-at > client-based issued-at
      let issuedAt = params?.issuedAt
      if (!issuedAt) {
        const serverTimeResult = await this.getServerTimeApprox()
        if (serverTimeResult.isOk) {
          issuedAt = serverTimeResult.value
        } else {
          console.error(
            `Unable to determine issuedAt time from server timestamp: ${serverTimeResult.error.message}`,
          )
          issuedAt = new Date()
        }
      }
      const expirationTime = new Date(issuedAt.getTime() + SESSION_DURATION_MS)
      const siweMessage = new SiweMessage({
        domain: new URL(this.config.baseUrl).hostname,
        // Some SIWE validators compare this against the checksummed signing address,
        // and thus will always fail if this address is not checksummed. This coerces
        // non-checksummed addresses to be checksummed.
        address: ethers.utils.getAddress(this.config.accountAddress),
        statement: 'Sign in with Ethereum',
        uri: `${this.config.baseUrl}/auth/login`,
        version: '1',
        chainId: NETWORK_CHAIN_IDS[this.config.network],
        nonce: generateNonce(),
        issuedAt: issuedAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
      })
      const message = siweMessage.prepareMessage()
      const body: AuthRequestBody = {
        message,
        signature: await this.signingFunction(message),
      }

      const response = await this.fetchImpl(
        `${this.config.baseUrl}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this._getAuthHeader(),
          },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        // On a non 200 response, the response should be a JSON including an error field.
        const data = await response.json()
        return handleError(data)
      }

      const headerSetCookie = response.headers.get('set-cookie')

      if (headerSetCookie) {
        headerSetCookie.split(',').forEach(async (cookie) => {
          await this.cookieJar.setCookie(
            Cookie.parse(cookie) ?? '',
            this.config.baseUrl,
            {
              ignoreError: true,
            },
          )
        })
      }

      this._sessionExpiry = expirationTime
      return Result.ok('success')
    } catch (error) {
      return handleError(error)
    }
  }

  async _createQuote(
    body: QuoteRequestBody,
    inOrOut: 'in' | 'out',
  ): Promise<Result<QuoteResponse, ResponseError>> {
    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/quote/${inOrOut}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this._getAuthHeader(),
          },
          body: JSON.stringify(body),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data as QuoteResponse)
    } catch (error) {
      return handleError(error)
    }
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
   * Returns an approximation of the current server time, taking into account clock differences
   * between client and server. Returns the earliest possible server time based on the max error
   * of the clock diff between client and server, to ensure that sessions created using this time
   * are not issued in the future with respect to the server clock.
   */
  async getServerTimeApprox(): Promise<Result<Date, ResponseError>> {
    const clockDiffResponse = await this.getClockDiffApprox()
    if (!clockDiffResponse.isOk) {
      return Result.err(clockDiffResponse.error)
    }
    return Result.ok(
      new Date(
        Date.now() +
          clockDiffResponse.value.diff -
          clockDiffResponse.value.maxError,
      ),
    )
  }

  /**
   * Convenience method to calculate the approximate difference between server and client clocks.
   */
  async getClockDiffApprox(): Promise<Result<ClockDiffResult, ResponseError>> {
    const t0 = Date.now()
    const clockResponse = await this.getClock()
    const t3 = Date.now()

    if (!clockResponse.isOk) {
      return Result.err(clockResponse.error)
    }

    const t1 = new Date(clockResponse.value.time).getTime()
    // We can assume that t1 and t2 are sufficiently close to each other
    const t2 = t1
    return Result.ok(this._calculateClockDiff({ t0, t1, t2, t3 }))
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#321-get-clock
   */
  async getClock(): Promise<Result<ClockResponse, ResponseError>> {
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/clock`, {
        method: 'GET',
        headers: this._getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3411-post-quotein
   */
  async createQuoteIn(
    params: QuoteRequestBody,
  ): Promise<Result<QuoteResponse, ResponseError>> {
    return this._createQuote(params, 'in')
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3412-post-quoteout
   */
  async createQuoteOut(
    params: QuoteRequestBody,
  ): Promise<Result<QuoteResponse, ResponseError>> {
    return this._createQuote(params, 'out')
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3421-post-kyckycschema
   */
  async addKyc<T extends KycSchema>(
    params: AddKycParams<T>,
  ): Promise<Result<KycStatusResponse, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/kyc/${params.kycSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this._getAuthHeader(),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3423-delete-kyckycschema
   */
  async deleteKyc(
    params: KycRequestParams,
  ): Promise<Result<void, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/kyc/${params.kycSchema}`,
        {
          method: 'DELETE',
          headers: this._getAuthHeader(),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(undefined)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3422-get-kyckycschemastatus
   */
  async getKycStatus(
    params: KycRequestParams,
  ): Promise<Result<KycStatusResponse, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/kyc/${params.kycSchema}/status`,
        {
          method: 'GET',
          headers: this._getAuthHeader(),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3431-post-accounts
   */
  async addFiatAccount<T extends FiatAccountSchema>(
    params: PostFiatAccountRequestBody<T>,
  ): Promise<Result<PostFiatAccountResponse, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(`${this.config.baseUrl}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAuthHeader(),
        },
        body: JSON.stringify(params),
      })
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3432-get-accounts
   */
  async getFiatAccounts(): Promise<
    Result<GetFiatAccountsResponse, ResponseError>
  > {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(`${this.config.baseUrl}/accounts`, {
        method: 'GET',
        headers: this._getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3433-delete-accountsfiataccountid
   */
  async deleteFiatAccount(
    params: DeleteFiatAccountRequestParams,
  ): Promise<Result<void, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/accounts/${params.fiatAccountId}`,
        {
          method: 'DELETE',
          headers: this._getAuthHeader(),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(undefined)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3441-post-transferin
   */
  async transferIn(
    params: TransferRequestParams,
  ): Promise<Result<TransferResponse, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/transfer/in`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
            ...this._getAuthHeader(),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3442-post-transferout
   */
  async transferOut(
    params: TransferRequestParams,
  ): Promise<Result<TransferResponse, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/transfer/out`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
            ...this._getAuthHeader(),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3443-get-transfertransferidstatus
   */
  async getTransferStatus(
    params: TransferStatusRequestParams,
  ): Promise<Result<TransferStatusResponse, ResponseError>> {
    try {
      await this._ensureLogin()
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/transfer/${params.transferId}/status`,
        {
          method: 'GET',
          headers: this._getAuthHeader(),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  async getCookies(): Promise<String> {
    return this.cookieJar.getCookieString(this.config.baseUrl)
  }
}

/**
 * handleError accepts three types of inputs:
 *  * a ResponseError object
 *  * a built-in Error object
 *  * A JSON payload from a non-200 FiatConnect API call
 *
 * handleError converts all of these into ResponseError objects wrapped
 * in a Result.err. If handleError is given data of a type not listed above,
 * it attempts to cast it to a string, put it in a ResponseError object, and
 * wrap it in a Result.err.
 **/
export function handleError<T>(error: unknown): Result<T, ResponseError> {
  // TODO: expose trace to make these errors more useful for clients
  if (error instanceof ResponseError) {
    return Result.err(error)
  } else if (error instanceof Error) {
    return Result.err(new ResponseError(error.message))
  } else if (error instanceof Object) {
    // We cast to QuoteErrorResponse here since it is a strict superset of all other
    // error response objects, allowing us to access all possible error-related fields.
    return Result.err(
      new ResponseError('FiatConnect API Error', error as QuoteErrorResponse),
    )
  }
  return Result.err(new ResponseError(String(error)))
}

export class FiatConnectClientWithCookie extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
  ) {
    super(config, signingFunction, fetch)
  }
}
