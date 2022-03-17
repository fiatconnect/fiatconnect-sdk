import { AddFiatAccountResponse, DeleteFiatAccountRequestParams, FiatAccountSchema, FiatConnectError, GetFiatAccountsResponse, KycRequestParams, KycSchema, KycStatusResponse, MockCheckingAccount, PersonalDataAndDocumentsKyc, QuoteErrorResponse, QuoteRequestQuery, QuoteResponse, TransferRequestBody, TransferResponse, TransferStatusRequestParams, TransferStatusResponse } from "@fiatconnect/fiatconnect-types"
import { RequestInit } from "node-fetch"
import { Result } from "ts-results"

export interface FiatConectApiClient {
    getQuoteIn(params: QuoteRequestQuery): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>>
    getQuoteOut(params: QuoteRequestQuery): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>>
    addKyc(params: AddKycParams): Promise<Result<KycStatusResponse, ErrorResponse>>
    deleteKyc(params: KycRequestParams): Promise<Result<void, ErrorResponse>>
    getKycStatus(params: KycRequestParams): Promise<Result<KycStatusResponse, ErrorResponse>>
    addFiatAccount(params: AddFiatAccountParams): Promise<Result<AddFiatAccountResponse, ErrorResponse>>
    getFiatAccounts(): Promise<Result<GetFiatAccountsResponse, ErrorResponse>>
    deleteFiatAccount(params: DeleteFiatAccountRequestParams): Promise<Result<void, ErrorResponse>>
    transferIn(params: TransferRequestBody): Promise<Result<TransferResponse, ErrorResponse>>
    transferOut(params: TransferRequestBody): Promise<Result<TransferResponse, ErrorResponse>>
    getTransferStatus(params: TransferStatusRequestParams): Promise<Result<TransferStatusResponse, ErrorResponse>>
}

// These must be manually updated as more KYC and FiatAccount types become standardized
export type KycSchemaData = PersonalDataAndDocumentsKyc
export type FiatAccountSchemaData = MockCheckingAccount

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
    accountAddress: string
}

export interface SignAndFetchParams {
    path: string
    requestOptions: RequestInit
}

export type ErrorResponse = {
    error: FiatConnectError | string
}