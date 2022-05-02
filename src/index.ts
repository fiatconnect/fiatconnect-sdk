import {
  AddFiatAccountResponse,
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
import fetch from 'node-fetch'
import { Ok, Err, Result } from 'ts-results'
import {
  AddFiatAccountParams,
  AddKycParams,
  ErrorResponse,
  FiatConectApiClient,
  FiatConnectClientConfig,
  TransferRequestParams,
  ClockResponse,
} from './types'

export default class FiatConnectClient implements FiatConectApiClient {
  config: FiatConnectClientConfig

  constructor(config: FiatConnectClientConfig) {
    this.config = config
  }

  async _getQuote(
    params: QuoteRequestQuery,
    jwt: string,
    inOrOut: 'in' | 'out',
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    try {
      const queryParams = new URLSearchParams(params).toString()
      const response = await fetch(
        `${this.config.baseUrl}/quote/${inOrOut}?${queryParams}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer: ${jwt}` },
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
   * https://en.wikipedia.org/wiki/Network_Time_Protocol#Clock_synchronization_algorithm
   *
   * Convenience method to calculate the difference between server and client clocks.
   * Returns the difference between the client and server clocks as a number of milliseconds.
   * Positive values mean the server's clock is ahead of the client's.
   */
  async getClockDiff(): Promise<Result<number, ErrorResponse>> {
    const t0 = Date.now()
    const clockResponse = await this.getClock()
    const t3 = Date.now()

    if (!clockResponse.ok) {
      return clockResponse
    }

    const t1 = new Date(clockResponse.val.time).getTime()
    // We can assume that t1 and t2 are sufficiently close to each other
    return Ok((t1 - t0 + t1 - t3) / 2)
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#321-get-clock
   */
  async getClock(): Promise<Result<ClockResponse, ErrorResponse>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/clock`, {
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
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3311-get-quotein
   */
  async getQuoteIn(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    return this._getQuote(params, jwt, 'in')
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3312-get-quoteout
   */
  async getQuoteOut(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    return this._getQuote(params, jwt, 'out')
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3321-post-kyckycschema
   */
  async addKyc(
    params: AddKycParams,
    jwt: string,
  ): Promise<Result<KycStatusResponse, ErrorResponse>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer: ${jwt}`,
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
    jwt: string,
  ): Promise<Result<void, ErrorResponse>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchema}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer: ${jwt}` },
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
    jwt: string,
  ): Promise<Result<KycStatusResponse, ErrorResponse>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/kyc/${params.kycSchema}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer: ${jwt}` },
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
    jwt: string,
  ): Promise<Result<AddFiatAccountResponse, ErrorResponse>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/accounts/${params.fiatAccountSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer: ${jwt}`,
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
  async getFiatAccounts(
    jwt: string,
  ): Promise<Result<GetFiatAccountsResponse, ErrorResponse>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/accounts`, {
        method: 'GET',
        headers: { Authorization: `Bearer: ${jwt}` },
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
    jwt: string,
  ): Promise<Result<void, ErrorResponse>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/accounts/${params.fiatAccountId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer: ${jwt}` },
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
    jwt: string,
  ): Promise<Result<TransferResponse, ErrorResponse>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/transfer/in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer: ${jwt}`,
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
    jwt: string,
  ): Promise<Result<TransferResponse, ErrorResponse>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/transfer/out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer: ${jwt}`,
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
    jwt: string,
  ): Promise<Result<TransferStatusResponse, ErrorResponse>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/transfer/${params.transferId}/status`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer: ${jwt}` },
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
