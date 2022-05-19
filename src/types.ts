import {
  AccountNumber,
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
} from '@fiatconnect/fiatconnect-types'
import { Result } from 'ts-results'

export interface FiatConnectApiClient {
  getClockDiffApprox(): Promise<Result<ClockDiffResult, ErrorResponse>>
  getClock(): Promise<Result<ClockResponse, ErrorResponse>>
  login(): Promise<Result<'success', ErrorResponse>>
  isLoggedIn(): boolean
  getQuoteIn(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>>
  getQuoteOut(
    params: QuoteRequestQuery,
    jwt: string,
  ): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>>
  addKyc(
    params: AddKycParams,
    jwt: string,
  ): Promise<Result<KycStatusResponse, ErrorResponse>>
  deleteKyc(
    params: KycRequestParams,
    jwt: string,
  ): Promise<Result<void, ErrorResponse>>
  getKycStatus(
    params: KycRequestParams,
    jwt: string,
  ): Promise<Result<KycStatusResponse, ErrorResponse>>
  addFiatAccount(
    params: AddFiatAccountParams,
    jwt: string,
  ): Promise<Result<AddFiatAccountResponse, ErrorResponse>>
  getFiatAccounts(
    jwt: string,
  ): Promise<Result<GetFiatAccountsResponse, ErrorResponse>>
  deleteFiatAccount(
    params: DeleteFiatAccountRequestParams,
    jwt: string,
  ): Promise<Result<void, ErrorResponse>>
  transferIn(
    params: TransferRequestParams,
    jwt: string,
  ): Promise<Result<TransferResponse, ErrorResponse>>
  transferOut(
    params: TransferRequestParams,
    jwt: string,
  ): Promise<Result<TransferResponse, ErrorResponse>>
  getTransferStatus(
    params: TransferStatusRequestParams,
    jwt: string,
  ): Promise<Result<TransferStatusResponse, ErrorResponse>>
}

// These must be manually updated as more KYC and FiatAccount types become standardized
export type KycSchemaData = PersonalDataAndDocumentsKyc // in the future this will be the union of all KYC schema types (currently there is just one)
export type FiatAccountSchemaData = AccountNumber // similarly, this will be the union of all fiat account schema types

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
  providerName: string
  iconUrl: string
  network: Network
  accountAddress: string
  apiKey?: string
}

export interface ErrorResponse {
  error: FiatConnectError | string
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
