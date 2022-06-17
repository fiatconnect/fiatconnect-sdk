import {
  DeleteFiatAccountRequestParams,
  FiatConnectError,
  GetFiatAccountsResponse,
  KycRequestParams,
  KycSchema,
  KycSchemas,
  KycStatusResponse,
  Network,
  PostFiatAccountRequestBody,
  PostFiatAccountResponse,
  QuoteErrorResponse,
  QuoteRequestQuery,
  QuoteResponse,
  TransferRequestBody,
  TransferResponse,
  TransferStatusRequestParams,
  TransferStatusResponse,
  ClockResponse,
  FiatAccountSchema,
} from '@fiatconnect/fiatconnect-types'
import { Result } from '@badrap/result'

export interface FiatConnectApiClient {
  getClockDiffApprox(): Promise<Result<ClockDiffResult, ResponseError>>
  getClock(): Promise<Result<ClockResponse, ResponseError>>
  login(): Promise<Result<'success', ResponseError>>
  isLoggedIn(): boolean
  getQuoteIn(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, ResponseError>>
  getQuoteOut(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, ResponseError>>
  addKyc<T extends KycSchema>(
    params: AddKycParams<T>,
    jwt: string,
  ): Promise<Result<KycStatusResponse, ResponseError>>
  deleteKyc(
    params: KycRequestParams,
    jwt: string,
  ): Promise<Result<void, ResponseError>>
  getKycStatus(
    params: KycRequestParams,
    jwt: string,
  ): Promise<Result<KycStatusResponse, ResponseError>>
  addFiatAccount<T extends FiatAccountSchema>(
    params: PostFiatAccountRequestBody<T>,
    jwt: string,
  ): Promise<Result<PostFiatAccountResponse, ResponseError>>
  getFiatAccounts(
    jwt: string,
  ): Promise<Result<GetFiatAccountsResponse, ResponseError>>
  deleteFiatAccount(
    params: DeleteFiatAccountRequestParams,
    jwt: string,
  ): Promise<Result<void, ResponseError>>
  transferIn(
    params: TransferRequestParams,
    jwt: string,
  ): Promise<Result<TransferResponse, ResponseError>>
  transferOut(
    params: TransferRequestParams,
    jwt: string,
  ): Promise<Result<TransferResponse, ResponseError>>
  getTransferStatus(
    params: TransferStatusRequestParams,
    jwt: string,
  ): Promise<Result<TransferStatusResponse, ResponseError>>
}

export interface AddKycParams<T extends KycSchema> {
  kycSchemaName: T
  data: KycSchemas[T]
}

export interface FiatConnectClientConfig {
  baseUrl: string
  network: Network
  accountAddress: string
  apiKey?: string
}

export interface TransferRequestParams {
  idempotencyKey: string
  data: TransferRequestBody
}

export interface ClockDiffParams {
  t0: number
  t1: number
  t2: number
  t3: number
}

export interface ClockDiffResult {
  diff: number
  maxError: number
}

// ResponseError is an error object that can act as a general error
// as well as contain details about a FiatConnect-specific error from
// an API.
export class ResponseError extends Error {
  fiatConnectError?: FiatConnectError

  minimumFiatAmount?: string
  maximumFiatAmount?: string
  minimumCryptoAmount?: string
  maximumCryptoAmount?: string

  // Because QuoteErrorResponse contains the `error` field (the only field returned
  // by all other endpoints on error) as well as additional quote-specific error
  // fields, we use it as the data type here.
  constructor(message: string, data?: QuoteErrorResponse) {
    super(message)
    Object.setPrototypeOf(this, ResponseError.prototype)

    this.fiatConnectError = data?.error
    this.minimumFiatAmount = data?.minimumFiatAmount
    this.maximumFiatAmount = data?.maximumFiatAmount
    this.minimumCryptoAmount = data?.minimumCryptoAmount
    this.maximumCryptoAmount = data?.maximumCryptoAmount
  }
}
