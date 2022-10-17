import { FiatConnectClient, SiweClient } from '../src/index-react-native'
import { Network } from '@fiatconnect/fiatconnect-types'
import * as siwe from 'siwe'
import 'jest-fetch-mock'
import CookieManager, { Cookies } from '@react-native-cookies/cookies'
import { mockClockResponse } from './mocks'

// work around from
// https://github.com/aelbore/esbuild-jest/issues/26#issuecomment-968853688 for
// mocking siwe packages
jest.mock('siwe', () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual('siwe'),
}))

const mockSetCookies: Cookies = {
  session: {
    name: 'session',
    value: 'session-val',
  },
}

jest.mock('@react-native-cookies/cookies', () => {
  return {
    get: jest.fn(),
  }
})

describe('FiatConnect SDK react-native', () => {
  describe('FiatConnectClient', () => {
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

      expect(client.fetchImpl).toEqual(fetch)
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
      expect(client.fetchImpl).toEqual(fetch)
    })
    describe('getCookies', () => {
      it('returns serialized cookies from login', async () => {
        jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
        fetchMock.mockResponseOnce(JSON.stringify(mockClockResponse))
        jest.spyOn(CookieManager, 'get').mockResolvedValue(mockSetCookies)
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
