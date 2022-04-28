import {
  AddFiatAccountResponse,
  AuthRequestBody,
  DeleteFiatAccountRequestParams,
  GetFiatAccountsResponse,
  KycRequestParams,
  KycStatusResponse,
  QuoteErrorResponse,
  QuoteRequestQuery,
  QuoteResponse,
  TransferResponse,
  TransferStatusRequestParams,
  TransferStatusResponse,
} from '@fiatconnect/fiatconnect-types'
import { ethers } from 'ethers'
import fetchCookie from 'fetch-cookie'
import nodeFetch from 'node-fetch'
import { generateNonce, SiweMessage } from 'siwe'
import { Ok, Err, Result } from 'ts-results'
import {
  AddFiatAccountParams,
  AddKycParams,
  ErrorResponse,
  FiatConectApiClient,
  FiatConnectClientConfig,
  TransferRequestParams,
} from './types'

const NETWORK_CHAIN_IDS = {
  alfajores: 44787,
  mainnet: 42220,
}

const fetch = fetchCookie(nodeFetch)

export default class FiatConnectClient implements FiatConectApiClient {
  config: FiatConnectClientConfig
  signingFunction: (message: string) => Promise<string>
  _sessionExpiry?: Date

  constructor(config: FiatConnectClientConfig, signingFunction: (message: string) => Promise<string>) {
    this.config = config
    this.signingFunction = signingFunction
  }

  async _ensureLogin() {
    const loginResult = await this.login()
    if (!loginResult.ok) {
      throw new Error(`Login failed: ${loginResult.val.error}`)
    }
  }

  /**
   * Logs in with the provider and initializes a session.
   *
   * @returns a Promise resolving to the literal string 'success' on a
   * successful login or an Error response.
   */
  async login(): Promise<Result<string, ErrorResponse>> {
    try {
      if (this._sessionExpiry && this._sessionExpiry < new Date()) {
        return Ok('success')
      }
      const expirationDate = new Date(Date.now() + 14400000) // 4 hours from now
      const siweMessage = new SiweMessage({
        domain: new URL(this.config.baseUrl).hostname,
        address: this.config.accountAddress,
        statement: 'Sign in with Ethereum',
        uri: `${this.config.baseUrl}/auth/login`,
        version: '1',
        chainId: NETWORK_CHAIN_IDS[this.config.celoNetwork],
        nonce: generateNonce(),
        expirationTime: expirationDate.toISOString(),
      })
      const message = siweMessage.prepareMessage()
      const body: AuthRequestBody = {
        message,
        signature: await this.signingFunction(message),
      }

      const response = await fetch(`${this.config.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        // On a non 200 response, the response should be a JSON including an error field.
        const data = await response.json()
        return Err(data as ErrorResponse)
      }

      this._sessionExpiry = expirationDate
      return Ok('success')
    } catch (error) {
      return handleError(error)
    }
  }

  async _getQuote(
    params: QuoteRequestQuery,
    inOrOut: 'in' | 'out',
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    try {
      const queryParams = new URLSearchParams(params).toString()
      const response = await fetch(
        `${this.config.baseUrl}/quote/${inOrOut}?${queryParams}`,
        {
          method: 'GET',
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data as QuoteErrorResponse)
      }
      return Ok(data as QuoteResponse)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3311-get-quotein
   */
  async getQuoteIn(
    params: QuoteRequestQuery,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    return this._getQuote(params, 'in')
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3312-get-quoteout
   */
  async getQuoteOut(
    params: QuoteRequestQuery,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    return this._getQuote(params, 'out')
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3321-post-kyckycschema
   */
  async addKyc(
    params: AddKycParams,
  ): Promise<Result<KycStatusResponse, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3323-delete-kyckycschema
   */
  async deleteKyc(
    params: KycRequestParams,
  ): Promise<Result<void, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchema}`,
        {
          method: 'DELETE',
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(undefined)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3322-get-kyckycschemastatus
   */
  async getKycStatus(
    params: KycRequestParams,
  ): Promise<Result<KycStatusResponse, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchema}`,
        {
          method: 'GET',
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3331-post-accountsfiataccountschema
   */
  async addFiatAccount(
    params: AddFiatAccountParams,
  ): Promise<Result<AddFiatAccountResponse, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(
        `${this.config.baseUrl}/accounts/${params.fiatAccountSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3332-get-accounts
   */
  async getFiatAccounts(): Promise<
    Result<GetFiatAccountsResponse, ErrorResponse>
  > {
    try {
      await this._ensureLogin()
      const response = await fetch(`${this.config.baseUrl}/accounts`, {
        method: 'GET',
      })
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3333-delete-accountfiataccountid
   */
  async deleteFiatAccount(
    params: DeleteFiatAccountRequestParams,
  ): Promise<Result<void, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(
        `${this.config.baseUrl}/accounts/${params.fiatAccountId}`,
        {
          method: 'DELETE',
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(undefined)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3341-post-transferin
   */
  async transferIn(
    params: TransferRequestParams,
  ): Promise<Result<TransferResponse, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(`${this.config.baseUrl}/transfer/in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify(params.data),
      })
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3342-post-transferout
   */
  async transferOut(
    params: TransferRequestParams,
  ): Promise<Result<TransferResponse, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(`${this.config.baseUrl}/transfer/out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify(params.data),
      })
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3343-get-transfertransferidstatus
   */
  async getTransferStatus(
    params: TransferStatusRequestParams,
  ): Promise<Result<TransferStatusResponse, ErrorResponse>> {
    try {
      await this._ensureLogin()
      const response = await fetch(
        `${this.config.baseUrl}/transfer/${params.transferId}/status`,
        {
          method: 'GET',
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return Err(data)
      }
      return Ok(data)
    } catch (error) {
      return handleError(error)
    }
  }
}

function handleError(error: unknown): Err<ErrorResponse> {
  if (error instanceof Error) {
    return Err({ ...error, error: error.message })
  }
  return Err({ error: String(error) })
}
