import { SiweClient } from '../src'
import * as siwe from 'siwe'
import 'jest-fetch-mock'

// work around from
// https://github.com/aelbore/esbuild-jest/issues/26#issuecomment-968853688 for
// mocking siwe packages
jest.mock('siwe', () => ({
  __esModule: true,
  // @ts-ignore
  ...jest.requireActual('siwe'),
}))

describe('SIWE client', () => {
  const accountAddress = '0x0d8e461687b7d06f86ec348e0c270b0f279855f0'
  const checksummedAccountAddress = '0x0D8e461687b7D06f86EC348E0c270b0F279855F0'
  const signingFunction = jest.fn(() => Promise.resolve('signed message'))
  const client = new SiweClient(
    {
      loginUrl: 'https://siwe-api.com/login',
      accountAddress,
      statement: 'Sign in with Ethereum',
      chainId: 1,
      version: '1',
      sessionDurationMs: 3600000,
    },
    signingFunction,
  )

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    jest.clearAllMocks()
    client._sessionExpiry = undefined
    client.cookieJar.removeAllCookiesSync()
  })

  describe('login', () => {
    it('calls login url and sets cookies in cookie jar', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('', {
        headers: { 'set-cookie': 'session=session-val' },
      })

      await client.login({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
      })

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'siwe-api.com',
        address: checksummedAccountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://siwe-api.com/login',
        nonce: '12345678',
        expirationTime: '2022-10-02T11:01:56.000Z',
        issuedAt: '2022-10-02T10:01:56.000Z',
        version: '1',
        chainId: 1,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://siwe-api.com/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
      expect(
        client.cookieJar.getCookiesSync('https://siwe-api.com'),
      ).toHaveLength(1)
      expect(
        client.cookieJar.getCookiesSync('https://siwe-api.com')[0],
      ).toEqual(
        expect.objectContaining({ key: 'session', value: 'session-val' }),
      )
    })
    it('calls login url with additional headers', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('', {
        headers: { 'set-cookie': 'session=session-val' },
      })

      await client.login({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
        headers: { Authorization: 'Bearer token' },
      })

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'siwe-api.com',
        address: checksummedAccountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://siwe-api.com/login',
        nonce: '12345678',
        expirationTime: '2022-10-02T11:01:56.000Z',
        issuedAt: '2022-10-02T10:01:56.000Z',
        version: '1',
        chainId: 1,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://siwe-api.com/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
    })
    it('throws if login returns error response', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('{"error": "InvalidParameters"}', {
        status: 400,
      })

      await expect(
        client.login({
          issuedAt: new Date('2022-10-02T10:01:56+0000'),
        }),
      ).rejects.toEqual(
        new Error(
          'Received error response on login: {"error": "InvalidParameters"}',
        ),
      )

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'siwe-api.com',
        address: checksummedAccountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://siwe-api.com/login',
        nonce: '12345678',
        expirationTime: '2022-10-02T11:01:56.000Z',
        issuedAt: '2022-10-02T10:01:56.000Z',
        version: '1',
        chainId: 1,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://siwe-api.com/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
    })
    it('defaults to client time for issued-at if none is provided', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')

      await client.login()

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'siwe-api.com',
        address: checksummedAccountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://siwe-api.com/login',
        nonce: '12345678',
        expirationTime: '2022-05-01T01:00:00.000Z',
        issuedAt: '2022-05-01T00:00:00.000Z',
        version: '1',
        chainId: 1,
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://siwe-api.com/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: expectedSiweMessage.prepareMessage(),
            signature: 'signed message',
          }),
        }),
      )
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

  describe('fetch', () => {
    const mockLogin = jest.spyOn(client, 'login')
    it('logs in before making request if an active session does not exist', async () => {
      client._sessionExpiry = new Date('2022-04-30T23:00:00Z')
      mockLogin.mockResolvedValueOnce()
      fetchMock.mockResponseOnce('response')

      const response = await client.fetch('https://siwe-api.com/some-url')

      await expect(response.text()).resolves.toEqual('response')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://siwe-api.com/some-url',
        undefined,
      )
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
    it('skips login if an active session exists', async () => {
      client._sessionExpiry = new Date('2022-05-01T03:00:00Z')
      fetchMock.mockResponseOnce('post response')

      const response = await client.fetch('https://siwe-api.com/some-url', {
        method: 'POST',
      })

      await expect(response.text()).resolves.toEqual('post response')
      expect(fetchMock).toHaveBeenCalledWith('https://siwe-api.com/some-url', {
        method: 'POST',
      })
      expect(mockLogin).not.toHaveBeenCalled()
    })
  })

  describe('getCookies', () => {
    it('returns serialized cookies from login', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('', {
        headers: {
          'set-cookie': 'session=session-val',
        },
      })

      await client.login({
        issuedAt: new Date('2022-10-02T10:01:56+0000'),
      })

      const cookies = await client.getCookies()
      expect(cookies).toBe('session=session-val')
    })
  })
})
