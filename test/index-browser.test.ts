import { FiatConnectClient, SiweClient } from '../src/index-browser'
import { Network } from '@fiatconnect/fiatconnect-types'

describe('FiatConnect SDK browser', () => {
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
      })
    })
  })

  describe('SiweClient', () => {
    it('creates client with fetch cookie', () => {
      const signingFunction = jest.fn(() => Promise.resolve('message'))
      const client = new SiweClient(
        {
          accountAddress: '0x123',
          chainId: 1,
          version: '1',
          statement: 'SIWE',
          loginUrl: 'https://fiatconnect-api/login',
          clockUrl: 'https://fiatconnect-api/clock',
          sessionDurationMs: 1000,
        },
        signingFunction,
      )

      expect(client.fetchImpl).toEqual(fetch)
    })
  })
})
