import 'cross-fetch/polyfill'
import { FiatConnectClientImpl } from './fiat-connect-client'
import { AddKycParams, FiatConnectClientConfig, ResponseError } from './types'
import makeFetchCookie from 'fetch-cookie'
import { CookieJar } from 'tough-cookie'
import { KycSchema, KycStatusResponse } from '@fiatconnect/fiatconnect-types'
import { Result } from '@badrap/result'
import { handleError } from './fiat-connect-client'

export class FiatConnectClient extends FiatConnectClientImpl {
  constructor(
    config: FiatConnectClientConfig,
    signingFunction: (message: string) => Promise<string>,
    cookieJar?: CookieJar.Serialized,
  ) {
    if (cookieJar) {
      super(
        config,
        signingFunction,
        makeFetchCookie(fetch, CookieJar.deserializeSync(cookieJar)),
        cookieJar,
      )
    } else {
      super(config, signingFunction, makeFetchCookie(fetch))
    }
  }

  /**
   * https://github.com/fiatconnect/specification/blob/main/fiatconnect-api.md#3421-post-kyckycschema
   * Same as implementation in fiat-connect-client.ts except check for _ensureLogin
   */
  async addKyc<T extends KycSchema>(
    params: AddKycParams<T>,
  ): Promise<Result<KycStatusResponse, ResponseError>> {
    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/kyc/${params.kycSchemaName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this._getAuthHeader(),
          },
          body: JSON.stringify(params.data),
        },
      )
      const data = await response.json()
      if (!response.ok) {
        return handleError(data)
      }
      return Result.ok(data)
    } catch (error) {
      return handleError(error)
    }
  }
}
