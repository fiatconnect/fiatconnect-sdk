import {
  CryptoType,
  DeleteFiatAccountRequestParams,
  FeeType,
  FiatAccountSchema,
  FiatAccountType,
  FiatConnectError,
  FiatType,
  GetFiatAccountsResponse,
  KycSchema,
  KycSchemas,
  KycStatus,
  KycStatusResponse,
  PostFiatAccountResponse,
  QuoteErrorResponse,
  QuoteRequestBody,
  QuoteResponse,
  TransferResponse,
  TransferStatus,
  TransferStatusRequestParams,
  TransferStatusResponse,
  TransferType,
  ClockResponse,
  FiatAccountSchemas,
} from '@fiatconnect/fiatconnect-types'
import { CreateQuoteParams, TransferRequestParams } from '../src/types'

export const mockCreateQuoteParams: CreateQuoteParams = {
  fiatType: FiatType.USD,
  cryptoType: CryptoType.cUSD,
  country: 'DE',
  address: '0x123',
}

export const mockQuoteRequestQuery: QuoteRequestBody = {
  ...mockCreateQuoteParams,
  preview: true,
}

export const mockQuoteInResponse: QuoteResponse = {
  quote: {
    fiatType: FiatType.USD,
    cryptoType: CryptoType.cUSD,
    fiatAmount: '1.0',
    cryptoAmount: '1.0',
    quoteId: 'mock_quote_id',
    guaranteedUntil: '2030-01-01T00:00:00.000Z',
    transferType: TransferType.TransferIn,
    fee: '.001',
    feeType: FeeType.PlatformFee,
  },
  kyc: {
    kycRequired: true,
    kycSchemas: [
      { kycSchema: KycSchema.PersonalDataAndDocuments, allowedValues: {} },
    ],
  },
  fiatAccount: {
    [FiatAccountType.BankAccount]: {
      fiatAccountSchemas: [
        {
          fiatAccountSchema: FiatAccountSchema.AccountNumber,
          allowedValues: {},
        },
      ],
    },
  },
}

export const mockQuoteOutResponse: QuoteResponse = {
  quote: {
    fiatType: FiatType.USD,
    cryptoType: CryptoType.cUSD,
    fiatAmount: '1.0',
    cryptoAmount: '1.0',
    quoteId: 'mock_quote_id',
    guaranteedUntil: '2030-01-01T00:00:00.000Z',
    transferType: TransferType.TransferOut,
    fee: '.001',
    feeType: FeeType.PlatformFee,
  },
  kyc: {
    kycRequired: true,
    kycSchemas: [
      { kycSchema: KycSchema.PersonalDataAndDocuments, allowedValues: {} },
    ],
  },
  fiatAccount: {
    [FiatAccountType.BankAccount]: {
      fiatAccountSchemas: [
        {
          fiatAccountSchema: FiatAccountSchema.AccountNumber,
          allowedValues: {},
        },
      ],
    },
  },
}

export const mockQuoteErrorResponse: QuoteErrorResponse = {
  error: FiatConnectError.GeoNotSupported,
}

export const mockKycSchemaData: KycSchemas[KycSchema.PersonalDataAndDocuments] =
  {
    firstName: 'Jacob',
    lastName: 'Smith',
    address: {
      address1: '943 Hiney Road',
      city: 'Las Vegas',
      isoRegionCode: 'NV',
      postalCode: '89119',
      isoCountryCode: 'US',
    },
    dateOfBirth: {
      day: '01',
      month: '05',
      year: '1992',
    },
    phoneNumber: '+13238475509',
    selfieDocument: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACA', // truncated for brevity
    identificationDocument:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABmJLR0QA', // also truncated for brevity
  }

export const mockKycStatusResponse: KycStatusResponse = {
  kycStatus: KycStatus.KycPending,
}

export const mockFiatAccountSchemaData: FiatAccountSchemas[FiatAccountSchema.AccountNumber] =
  {
    institutionName: 'Chase',
    accountName: 'Checking Account',
    accountNumber: '12533986',
    country: 'US',
    fiatAccountType: FiatAccountType.BankAccount,
  }

export const mockAddFiatAccountResponse: PostFiatAccountResponse = {
  fiatAccountId: '12345',
  accountName: 'Checking Account',
  institutionName: 'Chase',
  fiatAccountType: FiatAccountType.BankAccount,
  fiatAccountSchema: FiatAccountSchema.AccountNumber,
}

export const mockGetFiatAccountsResponse: GetFiatAccountsResponse = {
  [FiatAccountType.BankAccount]: [mockAddFiatAccountResponse],
}

export const mockDeleteFiatAccountParams: DeleteFiatAccountRequestParams = {
  fiatAccountId: '12358',
}

export const mockTransferRequestParams: TransferRequestParams = {
  idempotencyKey: '94d3fa9e-000b-4523-95e0-e9b6f7fcf849',
  data: {
    fiatAccountId: '12358',
    quoteId: 'mock_quote_id',
  },
}

export const mockTransferResponse: TransferResponse = {
  transferId: '82938',
  transferStatus: TransferStatus.TransferReadyForUserToSendCryptoFunds,
  transferAddress: '0xCC6DDE7638B2409e120e915adD948069CA619e10',
}

export const mockTransferStatusRequestParams: TransferStatusRequestParams = {
  transferId: '82938',
}

export const mockTransferStatusResponse: TransferStatusResponse = {
  status: TransferStatus.TransferComplete,
  transferType: TransferType.TransferIn,
  fiatType: FiatType.USD,
  cryptoType: CryptoType.cUSD,
  amountProvided: '5.0',
  amountReceived: '5.0',
  fiatAccountId: '12358',
  transferId: '82938',
  transferAddress: '0xCC6DDE7638B2409e120e915adD948069CA619e10',
  txHash: '0x4a6ae42bdb149459de201f22c11594da290a66b8affbb152e54ea4448f4bfaaa',
}

export const mockClockResponse: ClockResponse = {
  time: '2022-05-02T22:06:00+0000',
}
