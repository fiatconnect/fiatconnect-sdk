import {
  AccountNumber,
  DuniaWallet,
  MobileMoney,
  AddFiatAccountResponse,
  DeleteFiatAccountRequestParams,
  FiatAccountSchema,
  FiatConnectError,
  GetFiatAccountsResponse,
  KycRequestParams,
  KycSchema,
  KycStatusResponse,
  Network,
  PersonalDataAndDocumentsKyc,
  QuoteErrorResponse,
  QuoteRequestQuery,
  QuoteResponse,
  TransferRequestBody,
  TransferResponse,
  TransferStatusRequestParams,
  TransferStatusResponse,
  ClockResponse,
  IBANNumber,
  IFSCAccount,
} from '@fiatconnect/fiatconnect-types'
import { Result } from '@badrap/result'

export interface FiatConnectApiClient {
  getClockDiffApprox(): Promise<Result<ClockDiffResult, ResponseError>>
  getClock(): Promise<Result<ClockResponse, ResponseError>>
  login(): Promise<Result<'success', ResponseError>>
  isLoggedIn(): boolean
  getQuoteIn(
    params: QuoteRequestQuery,
  ): Promise<Result<QuoteResponse, ResponseError>>
  getQuoteOut(
    params: QuoteRequestQuery,
  ): Promise<Result<QuoteResponse, ResponseError>>
  addKyc(
    params: AddKycParams,
  ): Promise<Result<KycStatusResponse, ResponseError>>
  deleteKyc(params: KycRequestParams): Promise<Result<void, ResponseError>>
  getKycStatus(
    params: KycRequestParams,
  ): Promise<Result<KycStatusResponse, ResponseError>>
  addFiatAccount(
    params: AddFiatAccountParams,
  ): Promise<Result<AddFiatAccountResponse, ResponseError>>
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
}

// These must be manually updated as more KYC and FiatAccount types become standardized
export type KycSchemaData = PersonalDataAndDocumentsKyc // in the future this will be the union of all KYC schema types (currently there is just one)
export type FiatAccountSchemaData = // similarly, this will be the union of all fiat account schema types
  AccountNumber | MobileMoney | DuniaWallet | IBANNumber | IFSCAccount

export interface AddKycParams {
  kycSchemaName: KycSchema
  data: KycSchemaData
}

export interface AddFiatAccountParams {
  fiatAccountSchemaName: FiatAccountSchema
  data: FiatAccountSchemaData
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
