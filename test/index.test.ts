import FiatConnectClient from '../src/index'
import { mockAddFiatAccountResponse, mockDeleteFiatAccountParams, mockFiatAccountSchemaData, mockGetFiatAccountsResponse, mockKycSchemaData, mockKycStatusResponse, mockQuoteErrorResponse, mockQuoteRequestQuery, mockQuoteResponse, mockTransferRequestBody, mockTransferResponse, mockTransferStatusRequestParams, mockTransferStatusResponse } from './mocks'
import 'jest-fetch-mock'
import { FiatAccountSchema, FiatConnectError, KycSchema } from '@fiatconnect/fiatconnect-types'

const uuidv4Regex = new RegExp(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)

describe('FiatConnect SDK', () => {

    const client = new FiatConnectClient({
        baseUrl: 'https://fiat-connect-api.com',
        accountAddress: '0x7E98000458E0f8f903b0Aec7873406a7CA77FB09'
    })

    beforeEach(() => {
        fetchMock.resetMocks()
        jest.clearAllMocks()
    })
    describe('getQuoteIn', () => {
        it('calls /quote/in and returns QuoteResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockQuoteResponse))
            const response = await client.getQuoteIn(mockQuoteRequestQuery)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/quote/in?fiatType=USD&cryptoType=cUSD&country=Germany",
                expect.objectContaining({ method: 'GET'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockQuoteResponse)
        })
        it('handles API errors', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), { status: 400})
            const response = await client.getQuoteIn(mockQuoteRequestQuery)

            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(mockQuoteErrorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.getQuoteIn(mockQuoteRequestQuery)

            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('getQuoteOut', () => {
        it('calls /quote/out and returns QuoteResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockQuoteResponse))
            const response = await client.getQuoteOut(mockQuoteRequestQuery)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/quote/out?fiatType=USD&cryptoType=cUSD&country=Germany",
                expect.objectContaining({ method: 'GET'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockQuoteResponse)
        })
        it('handles API errors', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), { status: 400})
            const response = await client.getQuoteOut(mockQuoteRequestQuery)

            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(mockQuoteErrorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.getQuoteOut(mockQuoteRequestQuery)
            
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('addKyc', () => {
        it('calls POST /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
            const response = await client.addKyc({
                kycSchemaName: KycSchema.PersonalDataAndDocuments,
                data: mockKycSchemaData
            })
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/kyc/PersonalDataAndDocuments",
                expect.objectContaining({ method: 'POST'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockKycStatusResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceExists}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 409})
            const response = await client.addKyc({
                kycSchemaName: KycSchema.PersonalDataAndDocuments,
                data: mockKycSchemaData
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.addKyc({
                kycSchemaName: KycSchema.PersonalDataAndDocuments,
                data: mockKycSchemaData
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('deleteKyc', () => {
        it('calls DELETE /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify({}))
            const response = await client.deleteKyc({
                kycSchema: KycSchema.PersonalDataAndDocuments,
            })
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/kyc/PersonalDataAndDocuments",
                expect.objectContaining({ method: 'DELETE'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toBeUndefined()
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.deleteKyc({
                kycSchema: KycSchema.PersonalDataAndDocuments,
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.deleteKyc({
                kycSchema: KycSchema.PersonalDataAndDocuments,
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('getKycStatus', () => {
        it('calls GET /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
            const response = await client.getKycStatus({
                kycSchema: KycSchema.PersonalDataAndDocuments,
            })
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/kyc/PersonalDataAndDocuments",
                expect.objectContaining({ method: 'GET'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockKycStatusResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.getKycStatus({
                kycSchema: KycSchema.PersonalDataAndDocuments,
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.getKycStatus({
                kycSchema: KycSchema.PersonalDataAndDocuments,
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('addFiatAccount', () => {
        it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
            const response = await client.addFiatAccount({
                fiatAccountSchemaName: FiatAccountSchema.MockCheckingAccount,
                data: mockFiatAccountSchemaData
            })
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/accounts/MockCheckingAccount",
                expect.objectContaining({ method: 'POST'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockAddFiatAccountResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceExists}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 409})
            const response = await client.addFiatAccount({
                fiatAccountSchemaName: FiatAccountSchema.MockCheckingAccount,
                data: mockFiatAccountSchemaData
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.addFiatAccount({
                fiatAccountSchemaName: FiatAccountSchema.MockCheckingAccount,
                data: mockFiatAccountSchemaData
            })
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('getFiatAccounts', () => {
        it('calls GET /accounts and returns GetFiatAccountsResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockGetFiatAccountsResponse))
            const response = await client.getFiatAccounts()
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/accounts",
                expect.objectContaining({ method: 'GET'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockGetFiatAccountsResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.getFiatAccounts()
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.getFiatAccounts()
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('deleteFiatAccount', () => {
        it('calls DELETE /accounts/${params.fiatAccountId} and returns GetFiatAccountsResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify({}))
            const response = await client.deleteFiatAccount(mockDeleteFiatAccountParams)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/accounts/12358",
                expect.objectContaining({ method: 'DELETE'}))
            expect(response.ok).toBeTruthy()
            expect(response.val).toBeUndefined()
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.deleteFiatAccount(mockDeleteFiatAccountParams)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.deleteFiatAccount(mockDeleteFiatAccountParams)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('transferIn', () => {
        it('calls POST /transfer/in and returns TransferResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
            const response = await client.transferIn(mockTransferRequestBody)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/transfer/in",
                expect.objectContaining({ 
                    method: 'POST', 
                    headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(uuidv4Regex)})
                }))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockTransferResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.transferIn(mockTransferRequestBody)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.transferIn(mockTransferRequestBody)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })

    describe('transferOut', () => {
        it('calls POST /transfer/out and returns TransferResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
            const response = await client.transferOut(mockTransferRequestBody)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/transfer/out",
                expect.objectContaining({ 
                    method: 'POST', 
                    headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(uuidv4Regex)})
                }))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockTransferResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.transferOut(mockTransferRequestBody)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.transferOut(mockTransferRequestBody)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
    describe('getTransferStatus', () => {
        it('calls GET /transfer/${params.transferId}/status and returns TransferStatusResponse', async () => {
            fetchMock.mockResponseOnce(JSON.stringify(mockTransferStatusResponse))
            const response = await client.getTransferStatus(mockTransferStatusRequestParams)
            expect(fetchMock).toHaveBeenCalledWith(
                "https://fiat-connect-api.com/transfer/82938/status",
                expect.objectContaining({ 
                    method: 'GET', 
                }))
            expect(response.ok).toBeTruthy()
            expect(response.val).toMatchObject(mockTransferStatusResponse)
        })
        it('handles API errors', async () => {
            const errorResponse = {error: FiatConnectError.ResourceNotFound}
            fetchMock.mockResponseOnce(JSON.stringify(errorResponse), { status: 404})
            const response = await client.getTransferStatus(mockTransferStatusRequestParams)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject(errorResponse)
        })
        it('handles fetch errors', async () => {
            fetchMock.mockRejectOnce(new Error('fake error message'))
            const response = await client.getTransferStatus(mockTransferStatusRequestParams)
            expect(response.ok).toBeFalsy()
            expect(response.val).toMatchObject({
                error: 'fake error message'
            })
        })
    })
})