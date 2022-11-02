import {
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
  KycSchema,
  quoteResponseSchema,
  clockResponseSchema,
  kycStatusResponseSchema,
  postFiatAccountResponseSchema,
  getFiatAccountsResponseSchema,
  transferResponseSchema,
  transferStatusResponseSchema,
  QuotePreviewResponse,
  quotePreviewResponseSchema,
} from '@fiatconnect/fiatconnect-types'
import fetch from 'cross-fetch'
import { Result } from '@badrap/result'
import { fetchWithTimeout } from './fetch-timeout'
import {
  AddKycParams,
  ResponseError,
  FiatConnectApiClient,
  FiatConnectClientConfig,
  TransferRequestParams,
  ClockDiffResult,
  LoginParams,
  SiweApiClient,
  SiweClientConfig,
  CreateQuoteParams,
} from './types'
import { validate } from './validate'
import { z } from 'zod'

const NETWORK_CHAIN_IDS = {
  [Network.Alfajores]: 44787,
  [Network.Mainnet]: 42220,
}
const SESSION_DURATION_MS = 14400000 // 4 hours

export class FiatConnectClientImpl implements FiatConnectApiClient {
  config: FiatConnectClientConfig
  _siweClient: SiweApiClient
  fetchImpl: typeof fetch

  constructor(
    config: FiatConnectClientConfig,
    siweClient: SiweApiClient,
    fetchImpl: typeof fetch,
  ) {
    this.config = config
    this._siweClient = siweClient
    this.fetchImpl = config.timeout
      ? fetchWithTimeout(fetchImpl, config.timeout)
      : fetchImpl
  }

  /**
   * Checks if a logged in session exists with the provider.
   *
   * @returns true if an unexpired session exists with the provider, else false
   */
  isLoggedIn(): boolean {
    return this._siweClient.isLoggedIn()
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
      await this._siweClient.login({
        issuedAt: params?.issuedAt,
      })

      return Result.ok('success')
    } catch (error) {
      return handleError(error)
    }
  }

  async _createQuote<
    T extends typeof quotePreviewResponseSchema | typeof quoteResponseSchema,
  >(
    body: QuoteRequestBody,
    inOrOut: 'in' | 'out',
    schema: T,
  ): Promise<Result<z.infer<T>, ResponseError>> {
    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/quote/${inOrOut}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ..._getAuthHeader(this.config.apiKey),
          },
          body: JSON.stringify(body),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, schema)
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * Returns an approximation of the current server time, taking into account clock differences
   * between client and server. Returns the earliest possible server time based on the max error
   * of the clock diff between client and server, to ensure that sessions created using this time
   * are not issued in the future with respect to the server clock.
   */
  async getServerTimeApprox(): Promise<Result<Date, ResponseError>> {
    try {
      const data = await this._siweClient.getServerTimeApprox()
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * Convenience method to calculate the approximate difference between server and client clocks.
   */
  async getClockDiffApprox(): Promise<Result<ClockDiffResult, ResponseError>> {
    try {
      const data = await this._siweClient.getClockDiffApprox()
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#321-get-clock
   */
  async getClock(): Promise<Result<ClockResponse, ResponseError>> {
    try {
      const data = await this._siweClient.getClock()
      validate(data, clockResponseSchema)
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3411-post-quotein
   */
  async createQuoteIn(
    params: CreateQuoteParams,
  ): Promise<Result<QuoteResponse, ResponseError>> {
    return this._createQuote(
      { ...params, preview: false },
      'in',
      quoteResponseSchema,
    )
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3412-post-quoteout
   */
  async createQuoteOut(
    params: CreateQuoteParams,
  ): Promise<Result<QuoteResponse, ResponseError>> {
    return this._createQuote(
      { ...params, preview: false },
      'out',
      quoteResponseSchema,
    )
  }

  async getQuoteInPreview(
    params: CreateQuoteParams,
  ): Promise<Result<QuotePreviewResponse, ResponseError>> {
    return this._createQuote(
      { ...params, preview: true },
      'in',
      quotePreviewResponseSchema,
    )
  }

  async getQuoteOutPreview(
    params: CreateQuoteParams,
  ): Promise<Result<QuotePreviewResponse, ResponseError>> {
    return this._createQuote(
      { ...params, preview: true },
      'out',
      quotePreviewResponseSchema,
    )
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3421-post-kyckycschema
   */
  async addKyc<T extends KycSchema>(
    params: AddKycParams<T>,
  ): Promise<Result<KycStatusResponse, ResponseError>> {
    try {
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ..._getAuthHeader(this.config.apiKey),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, kycStatusResponseSchema)
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchema}`,
        {
          method: 'DELETE',
          headers: _getAuthHeader(this.config.apiKey),
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchema}/status`,
        {
          method: 'GET',
          headers: _getAuthHeader(this.config.apiKey),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, kycStatusResponseSchema)
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3431-post-accounts
   */
  async addFiatAccount(
    params: PostFiatAccountRequestBody,
  ): Promise<Result<PostFiatAccountResponse, ResponseError>> {
    try {
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/accounts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ..._getAuthHeader(this.config.apiKey),
          },
          body: JSON.stringify(params),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, postFiatAccountResponseSchema)
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/accounts`,
        {
          method: 'GET',
          headers: _getAuthHeader(this.config.apiKey),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, getFiatAccountsResponseSchema)
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/accounts/${params.fiatAccountId}`,
        {
          method: 'DELETE',
          headers: _getAuthHeader(this.config.apiKey),
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/transfer/in`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
            ..._getAuthHeader(this.config.apiKey),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, transferResponseSchema)
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/transfer/out`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
            ..._getAuthHeader(this.config.apiKey),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, transferResponseSchema)
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
      const response = await this._siweClient.fetch(
        `${this.config.baseUrl}/transfer/${params.transferId}/status`,
        {
          method: 'GET',
          headers: _getAuthHeader(this.config.apiKey),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      validate(data, transferStatusResponseSchema)
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  getCookies(): Record<string, string> {
    return this._siweClient.getCookies()
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
function handleError<T>(error: unknown): Result<T, ResponseError> {
  // TODO: expose trace to make these errors more useful for clients
  if (error instanceof ResponseError) {
    return Result.err(error)
  } else if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return Result.err(new ResponseError(error.name))
    }
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

export function createSiweConfig(
  config: FiatConnectClientConfig,
): SiweClientConfig {
  return {
    accountAddress: config.accountAddress,
    statement: 'Sign in with Ethereum',
    version: '1',
    chainId: NETWORK_CHAIN_IDS[config.network],
    sessionDurationMs: SESSION_DURATION_MS,
    loginUrl: `${config.baseUrl}/auth/login`,
    clockUrl: `${config.baseUrl}/clock`,
    headers: _getAuthHeader(config.apiKey),
    timeout: config.timeout,
  }
}

function _getAuthHeader(apiKey?: string) {
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` }
  }
}
