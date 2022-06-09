import { FiatConnectClient, ResponseError } from '../src/index'
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
import { Result } from '@badrap/result'

// work around from
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
  const getHeadersMock = jest.spyOn(client, '_getAuthHeader')

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    getHeadersMock.mockReset()
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
    it('calls /auth/login', async () => {
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toEqual('success')
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('returns error if login returns error response', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer api-key' })
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', {
          error: FiatConnectError.InvalidParameters,
        }),
      )
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('returns error if login throws', async () => {
      signingFunction.mockRejectedValueOnce(new Error('some error'))
      const response = await client.login()

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('some error'),
      )
      expect(getHeadersMock).not.toHaveBeenCalled()
    })
  })
  describe('isLoggedIn', () => {
    it('returns false when sessionExpiry does not exist', () => {
      expect(client.isLoggedIn()).toBeFalsy()
    })
    it('returns false when sessionExpiry exists but is too old', () => {
      client._sessionExpiry = new Date('2022-05-01T00:00:00+0000')
      const mockNow = new Date('2022-05-02T00:00:00+0000').getTime()
      jest.spyOn(global.Date, 'now').mockReturnValueOnce(mockNow)
      expect(client.isLoggedIn()).toBeFalsy()
    })
    it('returns true when sessionExpiry exists and is not too old', () => {
      client._sessionExpiry = new Date('2022-05-03T00:00:00+0000')
      const mockNow = new Date('2022-05-02T00:00:00+0000').getTime()
      jest.spyOn(global.Date, 'now').mockReturnValueOnce(mockNow)
      expect(client.isLoggedIn()).toBeTruthy()
    })
  })
  describe('_ensureLogin', () => {
    const mockLogin = jest.spyOn(client, 'login')
    it('calls login and returns successfully if sessionExpiry is in the past', async () => {
      client._sessionExpiry = new Date('2022-04-30T23:00:00Z')
      mockLogin.mockResolvedValueOnce(Result.ok('success'))
      await client._ensureLogin()
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
    it('skips login if session expiry is in the future', async () => {
      client._sessionExpiry = new Date('2022-05-01T03:00:00Z')
      await client._ensureLogin()
      expect(mockLogin).not.toHaveBeenCalled()
    })
    it('throws error if login fails', async () => {
      mockLogin.mockResolvedValueOnce(
        Result.err(new ResponseError('some error')),
      )
      await expect(async () => {
        await client._ensureLogin()
      }).rejects.toThrow(new ResponseError('some error'))
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })
  describe('_getAuthHeader', () => {
    it('returns auth header if client key is set', () => {
      const clientWithApiKey = new FiatConnectClient(
        {
          baseUrl: 'https://fiat-connect-api.com',
          providerName: exampleProviderName,
          iconUrl: exampleIconUrl,
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
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteResponse))
      const response = await client.getQuoteIn(mockQuoteRequestQuery)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/in?fiatType=USD&cryptoType=cUSD&country=DE',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockQuoteResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client.getQuoteIn(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', mockQuoteErrorResponse),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getQuoteIn(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
    })
  })
  describe('getQuoteOut', () => {
    it('calls /quote/out and returns QuoteResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteResponse))
      const response = await client.getQuoteOut(mockQuoteRequestQuery)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/quote/out?fiatType=USD&cryptoType=cUSD&country=DE',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockQuoteResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockQuoteErrorResponse), {
        status: 400,
      })
      const response = await client.getQuoteOut(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('FiatConnect API Error', mockQuoteErrorResponse),
      )
    })
    it('handles fetch errors', async () => {
      fetchMock.mockRejectOnce(new Error('fake error message'))
      const response = await client.getQuoteOut(mockQuoteRequestQuery)

      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toBeUndefined()
      expect(client._ensureLogin).toHaveBeenCalled()
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
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockAddFiatAccountResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('calls POST /accounts/${params.fiatAccountSchemaName} and returns AddFiatAccountResponse', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockAddFiatAccountResponse))
      getHeadersMock.mockReturnValueOnce({ Authorization: 'Bearer api-key' })
      const response = await client.addFiatAccount({
        fiatAccountSchemaName: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://fiat-connect-api.com/accounts/AccountNumber',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockAddFiatAccountResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
      expect(getHeadersMock).toHaveBeenCalled()
    })
    it('handles API errors', async () => {
      const errorData = { error: FiatConnectError.ResourceExists }
      fetchMock.mockResponseOnce(JSON.stringify(errorData), {
        status: 409,
      })
      const response = await client.addFiatAccount({
        fiatAccountSchemaName: FiatAccountSchema.AccountNumber,
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
        fiatAccountSchemaName: FiatAccountSchema.AccountNumber,
        data: mockFiatAccountSchemaData,
      })
      expect(response.isOk).toBeFalsy()
      expect(response.unwrap.bind(response)).toThrow(
        new ResponseError('fake error message'),
      )
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
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockGetFiatAccountsResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
        expect.objectContaining({ method: 'DELETE', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toBeUndefined()
      expect(client._ensureLogin).toHaveBeenCalled()
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
      expect(client._ensureLogin).toHaveBeenCalled()
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
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockTransferStatusResponse)
      expect(client._ensureLogin).toHaveBeenCalled()
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
