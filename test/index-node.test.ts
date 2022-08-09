import { FiatConnectClient } from '../src/index-node'
import { KycSchema, Network } from '@fiatconnect/fiatconnect-types'
import { CookieJar } from 'tough-cookie'
import { mockKycSchemaData, mockKycStatusResponse } from './mocks'
import 'jest-fetch-mock'

describe('FiatConnect Node SDK', () => {
  const accountAddress = '0x0d8e461687b7d06f86ec348e0c270b0f279855f0'
  const signingFunction = jest.fn(() => Promise.resolve('signed message'))
  const mockCookieJar = new CookieJar()
  mockCookieJar.setCookie('session=session-val', 'https://fiat-connect-api.com')
  const client = new FiatConnectClient(
    {
      baseUrl: 'https://fiat-connect-api.com',
      network: Network.Alfajores,
      accountAddress,
    },
    signingFunction,
    mockCookieJar.serializeSync(),
  )
  const getHeadersMock = jest.spyOn(client, '_getAuthHeader')

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    jest.clearAllMocks()
    client._sessionExpiry = undefined
  })
  describe('cookie handling', () => {
    it('inject cookie jar into client', async () => {
      const cookieJar = await client.getCookieJar()
      expect(cookieJar.cookies.length).toBe(1)
      expect(cookieJar.cookies[0].key).toBe('session')
      expect(cookieJar.cookies[0].value).toBe('session-val')
    })
    it('should include session cookies in add kyc call', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockKycStatusResponse))
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
            cookie: 'session=session-val',
          },
        }),
      )
      expect(response.isOk).toBeTruthy()
      expect(response.unwrap()).toMatchObject(mockKycStatusResponse)
      expect(getHeadersMock).toHaveBeenCalled()
    })
  })
})
