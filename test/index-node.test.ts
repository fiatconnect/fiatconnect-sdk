import { FiatConnectClient, SiweClient } from '../src/index-node'
import { Network } from '@fiatconnect/fiatconnect-types'
import * as siwe from 'siwe'
import 'jest-fetch-mock'
import { mockClockResponse } from './mocks'

// work around from
// https://github.com/aelbore/esbuild-jest/issues/26#issuecomment-968853688 for
// mocking siwe packages
jest.mock('siwe', () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual('siwe'),
}))

describe('FiatConnect SDK node', () => {
  describe('FiatConnectClient', () => {
    beforeEach(() => {
      fetchMock.resetMocks()
    })

    it('creates client with fetch cookie and siwe client', () => {
      const signingFunction = jest.fn(() => Promise.resolve('message'))
      const client = new FiatConnectClient(
        {
          accountAddress: '0x123',
          baseUrl: 'https://fiatconnect-api',
          network: Network.Alfajores,
        },
        signingFunction,
      )

      expect(client.fetchImpl.name).toEqual('fetchCookieWrapper')
      expect(client._siweClient).toBeInstanceOf(SiweClient)
      expect((client._siweClient as SiweClient).signingFunction).toEqual(
        signingFunction,
      )
      expect((client._siweClient as SiweClient).config).toEqual({
        accountAddress: '0x123',
        chainId: 44787,
        clockUrl: 'https://fiatconnect-api/clock',
        loginUrl: 'https://fiatconnect-api/auth/login',
        sessionDurationMs: 14400000,
        statement: 'Sign in with Ethereum',
        version: '1',
        headers: undefined,
      })
    })

    it('logs in with correct params before calling an endpoint that requires login', async () => {
      fetchMock.mockResponse(async (req) => {
        if (req.url.endsWith('/clock')) {
          return JSON.stringify(mockClockResponse)
        }
        if (req.url.endsWith('/auth/login')) {
          return {
            url: 'https://fiatconnect-api.com/auth/login/',
            body: 'ok',
            headers: {
              'set-cookie': 'session=session-val;Path=/',
            },
          }
        }
        return '{}'
      })

      const signingFunction = jest.fn(() => Promise.resolve('signed message'))
      const client = new FiatConnectClient(
        {
          accountAddress: '0x0D8e461687b7D06f86EC348E0c270b0F279855F0',
          baseUrl: 'https://fiatconnect-api.com',
          network: Network.Alfajores,
          apiKey: 'token',
        },
        signingFunction,
      )

      const response = await client.getFiatAccounts()
      expect(response.isOk).toEqual(true)
      expect(response.unwrap()).toEqual({})
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://fiatconnect-api.com/clock',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer token',
          },
        }),
      )
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://fiatconnect-api.com/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          },
        }),
      )
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'https://fiatconnect-api.com/accounts',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer token',
            cookie: 'session=session-val',
          },
        }),
      )
    })
  })

  describe('SiweClient', () => {
    const accountAddress = '0x0d8e461687b7d06f86ec348e0c270b0f279855f0'
    const signingFunction = jest.fn(() => Promise.resolve('signed message'))
    const client = new SiweClient(
      {
        accountAddress,
        statement: 'Sign in with Ethereum',
        chainId: 1,
        version: '1',
        sessionDurationMs: 3600000,
        loginUrl: 'https://siwe-api.com/login',
        clockUrl: 'https://siwe-api.com/clock',
      },
      signingFunction,
    )
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
      fetchMock.resetMocks()
      jest.clearAllMocks()
      client._sessionExpiry = undefined
    })

    it('creates client with fetch cookie', () => {
      expect(client.fetchImpl.name).toEqual('fetchCookieWrapper')
    })

    describe('_extractCookies', () => {
      it('parses header for cookies', async () => {
        const mockHeader = {
          raw: () => ({
            'set-cookie': ['session=session-val', 'session2=session-val2'],
          }),
        } as any as Headers

        await client._extractCookies(mockHeader)

        expect(client._cookieJar).toStrictEqual({
          session: 'session-val',
          session2: 'session-val2',
        })
      })
    })

    describe('getCookies', () => {
      it('returns serialized cookies from login', async () => {
        jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
        fetchMock.mockResponseOnce(JSON.stringify(mockClockResponse))
        fetchMock.mockResponseOnce('', {
          headers: {
            'set-cookie': 'session=session-val',
          },
        })

        await client.login()
        const cookies = client.getCookies()

        expect(cookies).toStrictEqual({ session: 'session-val' })
      })
    })
  })
})
