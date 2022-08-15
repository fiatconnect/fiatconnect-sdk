import { FiatConnectClient, ResponseError } from '../src'
import { SiweImpl } from '../src/siwe-client'
import {
  mockAddFiatAccountResponse,
  mockDeleteFiatAccountParams,
  mockFiatAccountSchemaData,
  mockGetFiatAccountsResponse,
  mockKycSchemaData,
  mockKycStatusResponse,
  mockQuoteErrorResponse,
  mockQuoteRequestQuery,
  mockQuoteInResponse,
  mockQuoteOutResponse,
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
import { Result } from '@badrap/result'
import { CookieJar, MemoryCookieStore } from 'tough-cookie'

jest.mock('../src/siwe-client')

describe('FiatConnect SDK', () => {
  const accountAddress = '0x0d8e461687b7d06f86ec348e0c270b0f279855f0'
  const signingFunction = jest.fn(() => Promise.resolve('signed message'))
  const siweLoginMock = jest.fn()
  const siweIsLoggedInMock = jest.fn()
  const siweGetServerTimeApprox = jest.fn()
  const siweGetClockDiffApprox = jest.fn()
  const siweGetClock = jest.fn()
  const siweGetCookiesMock = jest.fn()

  jest.mocked(SiweImpl).mockReturnValue({
    config: {
      accountAddress,
      statement: 'Sign in with Ethereum',
      chainId: 1,
      version: '1',
      sessionDurationMs: 3600000,
      loginUrl: 'https://siwe-api.com/login',
      clockUrl: 'https://siwe-api.com/clock',
    },
    signingFunction: jest.fn(),
    cookieJar: new CookieJar(new MemoryCookieStore(), {
      rejectPublicSuffixes: false,
    }),
    login: siweLoginMock,
    isLoggedIn: siweIsLoggedInMock,
    fetch: fetch, // use the real fetch here as it makes mocking easy with fetch mock
    fetchImpl: jest.fn(),
    getCookies: siweGetCookiesMock,
    getServerTimeApprox: siweGetServerTimeApprox,
    getClockDiffApprox: siweGetClockDiffApprox,
    getClock: siweGetClock,
    _calculateClockDiff: jest.fn(),
  })

  const client = new FiatConnectClient(
    {
      baseUrl: 'https://fiat-connect-api.com',
      network: Network.Alfajores,
      accountAddress,
    },
    signingFunction,
  )
  const getHeadersMock = jest.spyOn(client, '_getAuthHeader')

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    getHeadersMock.mockReset()
    siweLoginMock.mockReset()
    siweIsLoggedInMock.mockReset()
    siweGetServerTimeApprox.mockReset()
    siweGetClockDiffApprox.mockReset()
    siweGetClock.mockReset()
    jest.clearAllMocks()
  })
  describe('constructor', () => {
    it('creates siwe client with specified options', () => {
      const fcClient = new FiatConnectClient(
        {
          baseUrl: 'https://fiat-connect-api.com',
          network: Network.Alfajores,
          accountAddress,
        },
        signingFunction,
      )

      expect(fcClient._siweClient).toBeDefined()
      expect(SiweImpl).toHaveBeenCalledWith(
        {
          accountAddress,
          statement: 'Sign in with Ethereum',
          version: '1',
          chainId: 44787,
          sessionDurationMs: 14400000,
          loginUrl: 'https://fiat-connect-api.com/auth/login',
          clockUrl: 'https://fiat-connect-api.com/clock',
        },
        signingFunction,
        fetch,
      )
    })
  })
  describe('getClock', () => {
    it('gets the server clock using siwe client', async () => {
      siweGetClock.mockResolvedValueOnce(mockClockResponse)
      const response = await client.getClock()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockClockResponse)
    })
    it('handles errors', async () => {
      siweGetClock.mockRejectedValueOnce(new Error('fake error message'))
      const response = await client.getClock()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message', undefined),
      )
    })
  })
  describe('getServerTimeApprox', () => {
    it('gets using siwe client', async () => {
      siweGetServerTimeApprox.mockResolvedValueOnce(
        new Date('2022-05-01T00:00:00.500Z'),
      )
      const response = await client.getServerTimeApprox()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap().toISOString()).toEqual(
        '2022-05-01T00:00:00.500Z',
      )
    })
    it('returns an error if siwe client throws', async () => {
      siweGetServerTimeApprox.mockRejectedValueOnce(
        new Error('fake error message'),
      )
      const response = await client.getServerTimeApprox()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getClockDiffApprox', () => {
    it('gets using siwe client', async () => {
      siweGetClockDiffApprox.mockResolvedValueOnce({
        diff: 1000,
        maxError: 500,
      })

      const actualClockDiffResult = await client.getClockDiffApprox()
      expect(actualClockDiffResult.isOk).toBeTruthy()
      expect(actualClockDiffResult.unwrap()).toEqual({
        diff: 1000,
        maxError: 500,
      })
    })
    it('handles errors from siwe client', async () => {
      siweGetClockDiffApprox.mockRejectedValueOnce(
        new Error('fake error message'),
      )
      const response = await client.getClockDiffApprox()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('login', () => {
    it('calls siwe client login', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.resolve())
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer token' })
      const response = await client.login({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
      })

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toEqual('success')
      expect(getHeadersMock).toHaveBeenCalled()
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
        headers: { Authorization: 'Bearer token' },
      })
    })
    it('returns error if siwe login throws', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.reject('error'))
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer token' })
      const response = await client.login({
        issuedAt: new Date('2022-10-02T22:01:56+0000'),
      })

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(new ResponseError('error'))
      expect(getHeadersMock).toHaveBeenCalled()
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: new Date('2022-10-02T22:01:56+0000'),
        headers: { Authorization: 'Bearer token' },
      })
    })
    it('defaults to current server time for issued-at if none is provided', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.resolve())
      jest
        .spyOn(client, 'getServerTimeApprox')
        .mockResolvedValueOnce(Result.ok(new Date('2022-07-02T08:01:56+0000')))

      const response = await client.login()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toEqual('success')
      expect(getHeadersMock).toHaveBeenCalled()
      expect(client.getServerTimeApprox).toHaveBeenCalled()
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: new Date('2022-07-02T08:01:56+0000'),
        headers: undefined,
      })
    })
    it('falls back to client time if getting clock diff throws', async () => {
      siweLoginMock.mockImplementationOnce(() => Promise.resolve())
      jest
        .spyOn(client, 'getServerTimeApprox')
        .mockResolvedValueOnce(Result.err(new Error()))

      const response = await client.login()

      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toEqual('success')
      expect(getHeadersMock).toHaveBeenCalled()
      expect(client.getServerTimeApprox).toHaveBeenCalled()
      expect(siweLoginMock).toHaveBeenCalledWith({
        issuedAt: new Date('2022-05-01T00:00:00.000Z'),
        headers: undefined,
      })
    })
  })
  describe('isLoggedIn', () => {
    it('pipes siwe isLoggedIn', () => {
      siweIsLoggedInMock.mockReturnValueOnce(false)
      expect(client.isLoggedIn()).toBeFalsy()
      expect(siweIsLoggedInMock).toHaveBeenCalledWith()
    })
  })
  describe('_getAuthHeader', () => {
    it('returns auth header if client key is set', () => {
      const clientWithApiKey = new FiatConnectClient(
        {
          baseUrl: 'https://fiat-connect-api.com',
          network: Network.Alfajores,
          accountAddress,
          apiKey: 'some-api-key',
        },
        signingFunction,
      )
      expect(clientWithApiKey._getAuthHeader()).toEqual({
        Authorization: 'Bearer some-api-key',
      })
    })
    it('returns undefined if client key is not set', () => {
      expect(client._getAuthHeader()).toBeUndefined()
    })
  })
  describe('getQuoteIn', () => {
    it('calls /quote/in and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteInResponse))
      const response = await client.createQuoteIn(mockQuoteRequestQuery)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/in',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockQuoteRequestQuery),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockQuoteInResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client.createQuoteIn(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', mockQuoteErrorResponse),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.createQuoteIn(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getQuoteOut', () => {
    it('calls /quote/out and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteOutResponse))
      const response = await client.createQuoteOut(mockQuoteRequestQuery)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/out', // ?fiatType=USD&cryptoType=cUSD&country=DE
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockQuoteRequestQuery),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockQuoteOutResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client.createQuoteOut(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', mockQuoteErrorResponse),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.createQuoteOut(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('calls POST /kyc/${params.kycSchemaName} with auth header and returns KycStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer api-key' })
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 409,
      })
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.addKyc({
        kycSchemaName: KycSchema.PersonalDataAndDocuments,
        data: mockKycSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toBeUndefined()
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.deleteKyc({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.deleteKyc({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getKycStatus', () => {
    it('calls GET /kyc/${params.kycSchemaName} and returns KycStatusResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/kyc/PersonalDataAndDocuments/status',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getKycStatus({
        kycSchema: KycSchema.PersonalDataAndDocuments,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('addFiatAccount', () => {
    it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fiatAccountSchema: FiatAccountSchema.AccountNumber,
            data: mockFiatAccountSchemaData,
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockAddFiatAccountResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer api-key' })
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
          body: JSON.stringify({
            fiatAccountSchema: FiatAccountSchema.AccountNumber,
            data: mockFiatAccountSchemaData,
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockAddFiatAccountResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 409,
      })
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.addFiatAccount({
        fiatAccountSchema: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getFiatAccounts', () => {
    it('calls GET /accounts and returns GetFiatAccountsResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockGetFiatAccountsResponse))
      const response = await client.getFiatAccounts()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockGetFiatAccountsResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.getFiatAccounts()
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getFiatAccounts()
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
        expect.objectContaining({ method: 'DELETE', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toBeUndefined()
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.deleteFiatAccount(
        mockDeleteFiatAccountParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('calls POST /transfer/in with auth header and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer api-key' })
      const response = await client.transferIn(mockTransferRequestParams)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/in',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
            Authorization: 'Bearer api-key',
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.transferIn(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.transferIn(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('calls POST /transfer/out with auth header and returns TransferResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockTransferResponse))
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer api-key' })
      const response = await client.transferOut(mockTransferRequestParams)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/transfer/out',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': mockTransferRequestParams.idempotencyKey,
            Authorization: 'Bearer api-key',
          }),
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.transferOut(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.transferOut(mockTransferRequestParams)
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferStatusResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceNotFound }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 404,
      })
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', errorData),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getTransferStatus(
        mockTransferStatusRequestParams,
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })

  describe('getCookies', () => {
    it('returns cookies using siwe client', async () => {
      siweGetCookiesMock.mockResolvedValueOnce('fake cookies')

      const response = await client.getCookies()

      expect(response).toEqual('fake cookies')
    })
  })
})
