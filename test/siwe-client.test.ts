import { SiweImpl } from '../src/siwe-client'
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

class TestSiweClient extends SiweImpl {
  async _extractCookies(_headers?: Headers | undefined): Promise<void> {
    this._cookieJar = {}
  }
}

describe('SIWE client', () => {
  const accountAddress = '0x0d8e461687b7d06f86ec348e0c270b0f279855f0'
  const checksummedAccountAddress = '0x0D8e461687b7D06f86EC348E0c270b0F279855F0'
  const signingFunction = jest.fn(() => Promise.resolve('signed message'))
  const client = new TestSiweClient(
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
    fetch,
  )
  const clientWithLoginHeaders = new TestSiweClient(
    {
      accountAddress,
      statement: 'Sign in with Ethereum',
      chainId: 1,
      version: '1',
      sessionDurationMs: 3600000,
      loginUrl: 'https://siwe-api.com/login',
      clockUrl: 'https://siwe-api.com/clock',
      loginHeaders: { Authorization: 'Bearer token' },
    },
    signingFunction,
    fetch,
  )

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-05-01T00:00:00Z'))
    fetchMock.resetMocks()
    jest.clearAllMocks()
    client._sessionExpiry = undefined
  })

  describe('getClock', () => {
    it('gets the server clock', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockClockResponse))
      const response = await client.getClock()
      expect(fetchMock).toHaveBeenCalledWith('https://siwe-api.com/clock')
      expect(response).toMatchObject(mockClockResponse)
    })
    it('handles error responses', async () => {
      fetchMock.mockResponseOnce('error', { status: 500 })
      await expect(client.getClock()).rejects.toEqual(
        new Error('Received error response from clock endpoint: error'),
      )
    })
  })

  describe('getServerTimeApprox', () => {
    it('returns the earliest approximation of server time', async () => {
      jest
        .spyOn(client, 'getClockDiffApprox')
        .mockResolvedValueOnce({ diff: 1000, maxError: 500 })
      const response = await client.getServerTimeApprox()

      expect(response.toISOString()).toEqual('2022-05-01T00:00:00.500Z')
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
      jest.spyOn(client, 'getClock').mockResolvedValueOnce(mockClockResponse)
      const expectedClockDiffResult = {
        diff: 1000,
        maxError: 500,
      }
      jest
        .spyOn(client, '_calculateClockDiff')
        .mockReturnValueOnce(expectedClockDiffResult)

      const actualClockDiffResult = await client.getClockDiffApprox()
      expect(actualClockDiffResult).toEqual(expectedClockDiffResult)
      expect(client._calculateClockDiff).toHaveBeenCalledWith({
        t0,
        t1,
        t2,
        t3,
      })
    })
  })

  describe('login', () => {
    it('calls login url and sets cookies in cookie jar', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      jest.spyOn(client, '_extractCookies')
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
      expect(client._extractCookies).toBeCalled()
    })
    it('calls login url with additional headers', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      fetchMock.mockResponseOnce('', {
        headers: { 'set-cookie': 'session=session-val' },
      })

      await clientWithLoginHeaders.login({
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
    it('defaults to current server time for issued-at if none is provided', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      jest
        .spyOn(client, 'getServerTimeApprox')
        .mockResolvedValueOnce(new Date('2022-07-02T08:01:56+0000'))

      await client.login()

      const expectedSiweMessage = new siwe.SiweMessage({
        domain: 'siwe-api.com',
        address: checksummedAccountAddress,
        statement: 'Sign in with Ethereum',
        uri: 'https://siwe-api.com/login',
        nonce: '12345678',
        expirationTime: '2022-07-02T09:01:56.000Z',
        issuedAt: '2022-07-02T08:01:56.000Z',
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
    it('falls back to client time if getting clock diff throws', async () => {
      jest.spyOn(siwe, 'generateNonce').mockReturnValueOnce('12345678')
      jest
        .spyOn(client, 'getServerTimeApprox')
        .mockRejectedValueOnce(new Error('error fetching time'))

      await client.login({ issuedAt: undefined })

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
})
