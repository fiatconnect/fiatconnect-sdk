import {  AddFiatAccountResponse, DeleteFiatAccountRequestParams, FiatAccountSchema, FiatConnectError, GetFiatAccountsResponse, KycRequestParams, KycSchema, KycStatusResponse, MockCheckingAccount, MockNameAndAddressKyc, QuoteRequestQuery, QuoteResponse, TransferRequestBody, TransferResponse, TransferStatusRequestParams, TransferStatusResponse } from "@fiatconnect/fiatconnect-types"
import fetch, { RequestInit } from "node-fetch"
import { Ok, Err, Result } from "ts-results";

// These must be manually updated as more KYC and FiatAccount types become standardized
type KycSchemaData = MockNameAndAddressKyc
type FiatAccountSchemaData = MockCheckingAccount

interface AddKycParams {
    kycSchemaName: KycSchema
    data: KycSchemaData
}

interface AddFiatAccountParams {
    fiatAccountSchemaName: FiatAccountSchema
    data: FiatAccountSchemaData
}

interface FiatConnectClientConfig {
    baseUrl: string
    accountAddress: string
}

interface SignAndFetchParams {
    path: string
    requestOptions: RequestInit
  }

type QuoteErrorResponse = {
    error: FiatConnectError | string
    minimumFiatAmount?: number
    maximumFiatAmount?: number
    minimumCryptoAmount?: number
    maximumCryptoAmount?: number
  }

interface FiatConectApiClient {
    getQuoteIn(params: QuoteRequestQuery): Promise<Result<QuoteResponse, QuoteErrorResponse>>
    getQuoteOut(params: QuoteRequestQuery): Promise<Result<QuoteResponse, QuoteErrorResponse>>
    addKyc(params: AddKycParams): Promise<KycStatusResponse>
    deleteKyc(params: KycRequestParams): Promise<void>
    getKycStatus(params: KycRequestParams): Promise<KycStatusResponse>
    addFiatAccount(params: AddFiatAccountParams): Promise<AddFiatAccountResponse>
    getFiatAccounts(): Promise<GetFiatAccountsResponse>
    deleteFiatAccount(params: DeleteFiatAccountRequestParams): Promise<void>
    transferIn(params: TransferRequestBody): Promise<TransferResponse>
    transferOut(params: TransferRequestBody): Promise<TransferResponse>
    getTransferStatus(params: TransferStatusRequestParams): Promise<TransferStatusResponse>
}



export default class FiatConnectClient implements FiatConectApiClient {
    config: FiatConnectClientConfig

    constructor(config: FiatConnectClientConfig) {
        this.config = config
    }

      
  /**
   * A fetch wrapper that adds in the signature needed for IHL authorization
   *
   *
   * @param {params.path} string like /persona/get/foo
   * @param {params.accountMTWAddress} accountMTWAddress
   * @param {params.requestOptions} requestOptions all the normal fetch options
   * @returns {Response} response object from the fetch call
   */
    private signAndFetch({
        path,
        requestOptions,
      }: SignAndFetchParams): Promise<Response> {
        // TODO: Implement Auth
        const authHeader = 'Bearer: '
        return fetch(`${this.config.baseUrl}${path}`, {
            ...requestOptions,
            headers: {
                ...requestOptions.headers,
                Authorization: authHeader,
            },
        })
    }

    async getQuoteIn(params: QuoteRequestQuery) {
        try {
            const path = '/quote/in'
            const response = await this.signAndFetch({
                path,
                requestOptions: {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(params)
                    },
            })
            const data = await response.json()
            if(!response.ok) {
                return Err(data)
            }
            return Ok(data)
        } catch (error) {
            if(error instanceof Error) {
                return Err({error: error.message})
            }
            return Err({error: String(error)})
        }
    }
    
    async getQuoteOut(params: QuoteRequestQuery) {
        const path = '/quote/in'
        const response = await this.signAndFetch({
            path,
            requestOptions: {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
                },
        })
        const data = await response.json()
        if(!response.ok) {
            return Err(data)
        }
        return Ok(data)
    }
    
    addKyc() {
        //Todo
    }
    
    deleteKyc() {
        //Todo
    }
    
    getKycStatus() {
        //Todo
    }
    
    addFiatAccount() {
        //Todo
    }
    
    getFiatAccounts() {
        //Todo
    }
    
    deleteFiatAccount() {
        //Todo
    }
    
    transferIn() {
        //Todo
    }
    
    transferOut() {
        //Todo
    }
    
    getTransferStatus() {
        //Todo
    }
}