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
  QuoteRequestBody,
  QuoteResponse,
  TransferRequestBody,
  TransferResponse,
  TransferStatusRequestParams,
  TransferStatusResponse,
  ClockResponse,
  FiatAccountSchema,
} from '@fiatconnect/fiatconnect-types'
import { Result } from '@badrap/result'

export interface SiweClient {
  getServerTimeApprox(): Promise<Date>
  getClockDiffApprox(): Promise<ClockDiffResult>
  getClock(): Promise<ClockResponse>
  login(params?: SiweLoginParams): Promise<void>
  isLoggedIn(): boolean
  fetch: typeof fetch
  getCookies(): Promise<string>
}

export interface FiatConnectApiClient {
  getServerTimeApprox(): Promise<Result<Date, ResponseError>>
  getClockDiffApprox(): Promise<Result<ClockDiffResult, ResponseError>>
  getClock(): Promise<Result<ClockResponse, ResponseError>>
  login(params?: LoginParams): Promise<Result<'success', ResponseError>>
  isLoggedIn(): boolean
  createQuoteIn(
    params: QuoteRequestBody,
  ): Promise<Result<QuoteResponse, ResponseError>>
  createQuoteOut(
    params: QuoteRequestBody,
  ): Promise<Result<QuoteResponse, ResponseError>>
  addKyc<T extends KycSchema>(
    params: AddKycParams<T>,
  ): Promise<Result<KycStatusResponse, ResponseError>>
  deleteKyc(params: KycRequestParams): Promise<Result<void, ResponseError>>
  getKycStatus(
    params: KycRequestParams,
  ): Promise<Result<KycStatusResponse, ResponseError>>
  addFiatAccount<T extends FiatAccountSchema>(
    params: PostFiatAccountRequestBody<T>,
  ): Promise<Result<PostFiatAccountResponse, ResponseError>>
  getFiatAccounts(): Promise<Result<GetFiatAccountsResponse, ResponseError>>
  deleteFiatAccount(
    params: DeleteFiatAccountRequestParams,
  ): Promise<Result<void, ResponseError>>
  transferIn(
    params: TransferRequestParams,
  ): Promise<Result<TransferResponse, ResponseError>>
  transferOut(
    params: TransferRequestParams,
  ): Promise<Result<TransferResponse, ResponseError>>
  getTransferStatus(
    params: TransferStatusRequestParams,
  ): Promise<Result<TransferStatusResponse, ResponseError>>
  getCookies(): Promise<string>
}

export interface SiweClientConfig {
  accountAddress: string
  statement: string
  version: string
  chainId: number
  sessionDurationMs: number
  loginUrl: string
  clockUrl: string
}

export interface LoginParams {
  issuedAt?: Date
}

export type SiweLoginParams = LoginParams & {
  headers?: Record<string, string>
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
