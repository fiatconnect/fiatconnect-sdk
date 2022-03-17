import {  AddFiatAccountResponse, DeleteFiatAccountRequestParams,  GetFiatAccountsResponse,  KycRequestParams,  KycStatusResponse,  QuoteErrorResponse,  QuoteRequestQuery, QuoteResponse, TransferRequestBody, TransferResponse, TransferStatusRequestParams, TransferStatusResponse } from "@fiatconnect/fiatconnect-types"
import fetch, { Response } from "node-fetch"
import { Ok, Err, Result } from "ts-results";
import { v4 as uuidv4 } from 'uuid';
import { AddFiatAccountParams, AddKycParams, ErrorResponse, FiatConectApiClient, FiatConnectClientConfig, SignAndFetchParams } from "./types";

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

    async getQuoteIn(params: QuoteRequestQuery): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
        try {
            const queryParams = Object.entries(params).map(([key, value]) => 
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            ).join('&')
            const response = await this.signAndFetch({
                path: `/quote/in?${queryParams}`,
                requestOptions: {
                    method: 'GET'
                },
            })
            const data = await response.json()
            if(!response.ok) {
                return Err(data as QuoteErrorResponse)
            }
            return Ok(data as QuoteResponse)
        } catch (error) {
            if(error instanceof Error) {
                return Err({error: error.message})
            }
            return Err({error: String(error)})
        }
    }
    
    async getQuoteOut(params: QuoteRequestQuery): Promise<Result<QuoteResponse, QuoteErrorResponse | ErrorResponse>> {
        try {
            const queryParams = Object.entries(params).map(([key, value]) => 
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            ).join('&')
            const response = await this.signAndFetch({
                path: `/quote/out?${queryParams}`,
                requestOptions: {
                    method: 'GET'
                },
            })
            const data = await response.json()
            if(!response.ok) {
                return Err(data as QuoteErrorResponse)
            }
            return Ok(data as QuoteResponse)
        } catch (error) {
            if(error instanceof Error) {
                return Err({error: error.message})
            }
            return Err({error: String(error)})
        }
    }
    
    async addKyc(params: AddKycParams): Promise<Result<KycStatusResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/kyc/${params.kycSchemaName}`,
                requestOptions: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(params.data)
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
    
    async deleteKyc(params: KycRequestParams): Promise<Result<void, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/kyc/${params.kycSchema}`,
                requestOptions: {
                    method: 'DELETE'
                },
            })
            const data = await response.json()
            if(!response.ok) {
                return Err(data)
            }
            return Ok(undefined)
        } catch (error) {
            if(error instanceof Error) {
                return Err({error: error.message})
            }
            return Err({error: String(error)})
        }
    }

    async getKycStatus(params: KycRequestParams): Promise<Result<KycStatusResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/kyc/${params.kycSchema}`,
                requestOptions: {
                    method: 'GET'
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

    async addFiatAccount(params: AddFiatAccountParams): Promise<Result<AddFiatAccountResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/accounts/${params.fiatAccountSchemaName}`,
                requestOptions: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(params.data)
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

    async getFiatAccounts(): Promise<Result<GetFiatAccountsResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/accounts`,
                requestOptions: {
                    method: 'GET'
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
    
    async deleteFiatAccount(params: DeleteFiatAccountRequestParams): Promise<Result<void, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/accounts/${params.fiatAccountId}`,
                requestOptions: {
                    method: 'DELETE'
                },
            })
            const data = await response.json()
            if(!response.ok) {
                return Err(data)
            }
            return Ok(undefined)
        } catch (error) {
            if(error instanceof Error) {
                return Err({error: error.message})
            }
            return Err({error: String(error)})
        }
    }

    async transferIn(params: TransferRequestBody): Promise<Result<TransferResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/transfer/in`,
                requestOptions: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': uuidv4()
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

    async transferOut(params: TransferRequestBody): Promise<Result<TransferResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/transfer/out`,
                requestOptions: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': uuidv4()
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

    async getTransferStatus(params: TransferStatusRequestParams): Promise<Result<TransferStatusResponse, ErrorResponse>> {
        try {
            const response = await this.signAndFetch({
                path: `/transfer/${params.transferId}/status`,
                requestOptions: {
                    method: 'GET'
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
    
}