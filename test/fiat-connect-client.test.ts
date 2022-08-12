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

  jest.mocked(SiweImpl).mockReturnValue({
    config: {
      loginUrl: 'https://siwe-api.com/login',
      accountAddress,
      statement: 'Sign in with Ethereum',
      chainId: 1,
      version: '1',
      sessionDurationMs: 3600000,
    },
    signingFunction: jest.fn(),
    cookieJar: new CookieJar(new MemoryCookieStore(), {
      rejectPublicSuffixes: false,
    }),
    login: siweLoginMock,
    isLoggedIn: siweIsLoggedInMock,
    fetch: fetch, // use the real fetch here as it makes mocking easy with fetch mock
    fetchImpl: jest.fn(),
    getCookies: jest.fn(),
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
          loginUrl: 'https://fiat-connect-api.com/auth/login',
          statement: 'Sign in with Ethereum',
          version: '1',
          chainId: 44787,
          sessionDurationMs: 14400000,
        },
        signingFunction,
        fetch,
      )
    })
  })
  describe('getClock', () => {
    it('gets the server clock', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockClockResponse))
      const response = await client.getClock()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/clock',
        expect.objectContaining({
          method: 'GET',
          headers: undefined,
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockClockResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getClock()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message', undefined),
      )
    })
  })
  describe('getServerTimeApprox', () => {
    it('returns the earliest approximation of server time', async () => {
      jest
        .spyOn(client, 'getClockDiffApprox')
        .mockResolvedValueOnce(Result.ok({ diff: 1000, maxError: 500 }))
      const response = await client.getServerTimeApprox()

      expect(response.isOk).toBeTruthy()
      expect((response.unwrap() as Date).toISOString()).toEqual(
        '2022-05-01T00:00:00.500Z',
      )
    })
    it('returns an error if clock diff throws', async () => {
      jest
        .spyOn(client, 'getClockDiffApprox')
        .mockResolvedValueOnce(
          Result.err(new ResponseError('fake error message')),
        )
      const response = await client.getServerTimeApprox()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
        .mockResolvedValueOnce(Result.ok(mockClockResponse))
      const expectedClockDiffResult = {
        diff: 1000,
        maxError: 500,
      }
      jest
        .spyOn(client, '_calculateClockDiff')
        .mockReturnValueOnce(expectedClockDiffResult)

      const actualClockDiffResult = await client.getClockDiffApprox()
      expect(actualClockDiffResult.isOk).toBeTruthy()
      expect(actualClockDiffResult.unwrap()).toEqual(expectedClockDiffResult)
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
})
