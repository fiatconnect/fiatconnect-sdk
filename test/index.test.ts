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
  mockClockResponse,
} from './mocks'
import 'jest-fetch-mock'
import {
  FiatAccountSchema,
  FiatConnectError,
  KycSchema,
  Network,
} from '@fiatconnect/fiatconnect-types'
import * as siwe from 'siwe'
import { Err, Ok } from 'ts-results'

// Work around from
// https://github.com/aelbore/esbuild-jest/issues/26#issuecomment-968853688 for
// mocking siwe packages
jest.mock('siwe', () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual('siwe'),
}))

describe('FiatConnect SDK', () => {
  const exampleIconUrl =
    'https://storage.googleapis.com/celo-mobile-mainnet.appspot.com/images/valora-icon.png'
  const exampleProviderName = 'Example Provider'
  const accountAddress = '0x0D8e461687b7D06f86EC348E0c270b0F279855F0'
  const signingFunction = jest.fn(() => Promise.resolve('signed message'))
  const client = new FiatConnectClient(
    {
      baseUrl: 'https://fiat-connect-api.com',
      providerName: exampleProviderName,
      iconUrl: exampleIconUrl,
      network: Network.Alfajores,
      accountAddress,
    },
    signingFunction,
  )

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    jest.clearAllMocks()
    client._sessionExpiry = undefined
  })
  it('Provider name and icon can be accessed', () => {
    expect(client.config.providerName).toEqual(exampleProviderName)
    expect(client.config.iconUrl).toEqual(exampleIconUrl)
  })
  describe('getClock', () => {
    it('gets the server clock', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockClockResponse))
      const response = await client.getClock()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/clock',
        expect.objectContaining({
          method: 'GET',
        }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockClockResponse)
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getClock()

      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('_calculateClockDiff', () => {
    it('calculates clock diff when server is ahead', async () => {
      const t0 = 10000
      const t1 = 10500
      const t2 = 10500
      const t3 = 10500
      const clockDiffResult = client._calculateClockDiff({ t0, t1, t2, t3 })
      expect(clockDiffResult.diff).toEqual(250)
      expect(clockDiffResult.maxError).toEqual(250)
    })
    it('calculates clock diff when server is behind', async () => {
      const t0 = 10000
      const t1 = 9500
      const t2 = 9500
      const t3 = 10500
      const clockDiffResult = client._calculateClockDiff({ t0, t1, t2, t3 })
      expect(clockDiffResult.diff).toEqual(-750)
      expect(clockDiffResult.maxError).toEqual(250)
    })
  })
  describe('getClockDiffApprox', () => {
    it('calculates clock diff with correct arguments', async () => {
      const t0 = new Date('2022-05-02T22:05:55+0000').getTime()
      const t1 = new Date(mockClockResponse.time).getTime()
      const t2 = t1
      const t3 = new Date('2022-05-02T22:05:56+0000').getTime()
      jest
        .spyOn(global.Date, 'now')
        .mockReturnValueOnce(t0)
        .mockReturnValueOnce(t3)
      jest
        .spyOn(client, 'getClock')
        .mockResolvedValueOnce(Ok(mockClockResponse))
      const expectedClockDiffResult = {
        diff: 1000,
        maxError: 500,
      }
      jest
        .spyOn(client, '_calculateClockDiff')
        .mockReturnValueOnce(expectedClockDiffResult)

      const actualClockDiffResult = await client.getClockDiffApprox()
      expect(actualClockDiffResult.ok).toBeTruthy()
      expect(actualClockDiffResult.val).toEqual(expectedClockDiffResult)
      expect(client._calculateClockDiff).toHaveBeenCalledWith({
        t0,
        t1,
        t2,
        t3,
      })
    })
    it('handles errors when getting server clock', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getClockDiffApprox()

      expect(response.ok).toBeFalsy()
      expect(response.val).toMatchObject({
        error: 'fake error message',
      })
    })
  })
  describe('login', () => {
    it('calls /auth/login if sessionExpiry is not set', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('', {
        headers: { 'set-cookie': 'session=session-val' },
      })

      const response = await client.login()

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'fiat-connect-api.com',
        address: accountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://fiat-connect-api.com/auth/login',
        nonce: '12345678',
        expirationTime: '2022-05-01T04:00:00.000Z',
        version: '1',
        chainId: 44787,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toEqual('success')
    })
    it('calls /auth/login if sessionExpiry is in the past', async () => {
      client._sessionExpiry = new Date('2022-04-30T23:00:00Z')
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('', {
        headers: { 'set-cookie': 'session=session-val' },
      })

      const response = await client.login()

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'fiat-connect-api.com',
        address: accountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://fiat-connect-api.com/auth/login',
        nonce: '12345678',
        expirationTime: '2022-05-01T04:00:00.000Z',
        version: '1',
        chainId: 44787,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toEqual('success')
    })
    it('skips login if session expiry is in the future', async () => {
      client._sessionExpiry = new Date('2022-05-01T03:00:00Z')
      const response = await client.login()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(response.ok).toBeTruthy()
      expect(response.val).toEqual('success')
    })
    it('returns error if login returns error response', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('{"error": "InvalidParameters"}', {
        status: 400,
      })

      const response = await client.login()

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'fiat-connect-api.com',
        address: accountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://fiat-connect-api.com/auth/login',
        nonce: '12345678',
        expirationTime: '2022-05-01T04:00:00.000Z',
        version: '1',
        chainId: 44787,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
      expect(response.ok).toBeFalsy()
      expect(response.val).toEqual({ error: 'InvalidParameters' })
    })
    it('returns error if login throws', async () => {
      signingFunction.mockRejectedValueOnce('sign error')
      const response = await client.login()

      expect(response.ok).toBeFalsy()
      expect(response.val).toEqual({ error: 'sign error' })
    })
  })
  describe('_ensureLogin', () => {
    it('succeeds if login succeeds', async () => {
      jest.spyOn(client, 'login').mockResolvedValueOnce(Ok('success'))
      await client._ensureLogin()
    })
    it('throws error if login fails', async () => {
      jest
        .spyOn(client, 'login')
        .mockResolvedValueOnce(Err({ error: 'invalid login' }))
      await expect(async () => {
        await client._ensureLogin()
      }).rejects.toThrow('Login failed: invalid login')
    })
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
    it('calls GET /accounts and returns GetFiatAccountsResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockGetFiatAccountsResponse))
      const response = await client.getFiatAccounts()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(response.ok).toBeTruthy()
      expect(response.val).toMatchObject(mockGetFiatAccountsResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
    beforeEach(() => {
      jest.spyOn(client, '_ensureLogin').mockResolvedValueOnce()
    })
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
