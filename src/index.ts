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
} from './types'

export default class FiatConnectClient implements FiatConectApiClient {
  config: FiatConnectClientConfig

  constructor(config: FiatConnectClientConfig) {
    this.config = config
  }

  async getQuoteIn(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    try {
      const queryParams = Object.entries(params)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&')
      const response = await fetch(
        `${this.config.baseUrl}/quote/in?${queryParams}`,
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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

  async getQuoteOut(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
    try {
      const queryParams = Object.entries(params)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&')
      const response = await fetch(
        `${this.config.baseUrl}/quote/out?${queryParams}`,
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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }

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
      if (error instanceof Error) {
        return Err({ error: error.message })
      }
      return Err({ error: String(error) })
    }
  }
}
