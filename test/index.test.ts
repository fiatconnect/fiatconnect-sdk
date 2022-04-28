import FiatConnectClient from '../src/index'
import {
  mockAddFiatAccountResponse,
  mockDeleteFiatAccountParams,
  mockFiatAccountSchemaData,
  mockGetFiatAccountsResponse,
  mockKycSchemaData,
  mockKycStatusResponse,
  mockQuoteErrorResponse,
  mockQuoteRequestQuery,
  mockQuoteResponse,
  mockTransferRequestParams,
  mockTransferResponse,
  mockTransferStatusRequestParams,
  mockTransferStatusResponse,
} from './mocks'
import 'jest-fetch-mock'
import {
  FiatAccountSchema,
  FiatConnectError,
  KycSchema,
} from '@fiatconnect/fiatconnect-types'

describe('FiatConnect SDK', () => {
  const exampleIconUrl =
    'https://storage.googleapis.com/celo-mobile-mainnet.appspot.com/images/valora-icon.png'
  const exampleProviderName = 'Example Provider'
  const client = new FiatConnectClient({
    baseUrl: 'https://fiat-connect-api.com',
    providerName: exampleProviderName,
    iconUrl: exampleIconUrl,
    celoNetwork: 'alfajores',
    privateKey:
      '0x9999999999999999999999999999999999999999999999999999999999999999',
    accountAddress: '0x0D8e461687b7D06f86EC348E0c270b0F279855F0',
  })

  beforeEach(() => {
    fetchMock.resetMocks()
    jest.clearAllMocks()
    client._ensureLogin = jest.fn()
  })
  it('Provider name and icon can be accessed', () => {
    expect(client.config.providerName).toEqual(exampleProviderName)
    expect(client.config.iconUrl).toEqual(exampleIconUrl)
  })
  describe('getQuoteIn', () => {
    it('calls /quote/in and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteResponse))
      const response = await client.getQuoteIn(mockQuoteRequestQuery)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/in?fiatType=USD&cryptoType=cUSD&country=DE',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockQuoteResponse)
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client.getQuoteIn(mockQuoteRequestQuery)

      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(mockQuoteErrorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getQuoteIn(mockQuoteRequestQuery)

      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('getQuoteOut', () => {
    it('calls /quote/out and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteResponse))
      const response = await client.getQuoteOut(mockQuoteRequestQuery)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/out?fiatType=USD&cryptoType=cUSD&country=DE',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockQuoteResponse)
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client.getQuoteOut(mockQuoteRequestQuery)

      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(mockQuoteErrorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getQuoteOut(mockQuoteRequestQuery)

      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('addKyc', () => {
    it('calls POST /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockKycStatusResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 409,
      })
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('deleteKyc', () => {
    it('calls DELETE /kyc/${params.kycSchemaName} and returns undefined', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}))
      const response = await client.deleteKyc({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toBeUndefined()
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
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
        error: 'fake error message',
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
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockKycStatusResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
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
        error: 'fake error message',
      })
    })
  })
  describe('addFiatAccount', () => {
    it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
      const response = await client.addFiatAccount({
        fiatAccountSchemaName: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts/AccountNumber',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockAddFiatAccountResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 409,
      })
      const response = await client.addFiatAccount({
        fiatAccountSchemaName: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.addFiatAccount({
        fiatAccountSchemaName: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('getFiatAccounts', () => {
    it('calls GET /accounts and returns GetFiatAccountsResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockGetFiatAccountsResponse))
      const response = await client.getFiatAccounts()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockGetFiatAccountsResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
      const response = await client.getFiatAccounts()
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getFiatAccounts()
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('deleteFiatAccount', () => {
    it('calls DELETE /accounts/${params.fiatAccountId} and returns undefined', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}))
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts/12358',
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toBeUndefined()
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('transferIn', () => {
    it('calls POST /transfer/in and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      const response = await client.transferIn(mockTransferRequestParams)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/in',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
          }),
        }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockTransferResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
      const response = await client.transferIn(mockTransferRequestParams)
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.transferIn(mockTransferRequestParams)
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })

  describe('transferOut', () => {
    it('calls POST /transfer/out and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      const response = await client.transferOut(mockTransferRequestParams)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/out',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
          }),
        }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockTransferResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
      const response = await client.transferOut(mockTransferRequestParams)
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.transferOut(mockTransferRequestParams)
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })

  describe('getTransferStatus', () => {
    it('calls GET /transfer/${params.transferId}/status and returns TransferStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferStatusResponse))
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/82938/status',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockTransferStatusResponse)
    })
    it('handles API errors', async () => {
      const errorResponse = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorResponse), {
        status: 404,
      })
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject(errorResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
})
