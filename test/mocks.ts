import { AddFiatAccountResponse, CryptoType, DeleteFiatAccountRequestParams, FeeType, FiatAccountSchema, FiatAccountType, FiatConnectError, FiatType, GetFiatAccountsResponse, KycSchema, KycStatus, KycStatusResponse, QuoteErrorResponse, QuoteRequestQuery, QuoteResponse, TransferRequestBody, TransferResponse, TransferStatus, TransferStatusRequestParams, TransferStatusResponse, TransferType } from "@fiatconnect/fiatconnect-types"
import { FiatAccountSchemaData, KycSchemaData } from "../src/types"

export const mockQuoteRequestQuery: QuoteRequestQuery = {
    fiatType: FiatType.USD,
    cryptoType: CryptoType.cUSD,
    country: 'Germany'
}

export const mockQuoteResponse: QuoteResponse = {
    quote: {
        fiatType: FiatType.USD,
        cryptoType: CryptoType.cUSD,
        fiatAmount: '1.0',
        cryptoAmount: '1.0'
    },
    kyc: {
        kycRequired: true,
        kycSchemas: [KycSchema.PersonalDataAndDocuments]
    },
    fiatAccount: {
        [FiatAccountType.MockCheckingAccount]: {
            fiatAccountSchemas: [FiatAccountSchema.MockCheckingAccount],
            fee: '.001',
            feeType: FeeType.PlatformFee
        }
    }
}

export const mockQuoteErrorResponse: QuoteErrorResponse = {
    error: FiatConnectError.GeoNotSupported
}

export const mockKycSchemaData: KycSchemaData = {
    firstName: 'Jacob',
    lastName: 'Smith',
    address: {
        address1: '943 Hiney Road',
        city: 'Las Vegas',
        isoRegionCode: 'NV',
        postalCode: '89119',
        isoCountryCode: 'US'
    },
    dateOfBirth: {
        day: '01',
        month: '05',
        year: '1992'
    },
    phoneNumber: '+13238475509',
    selfieDocument: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACA', // truncated for brevity
    identificationDocument: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABmJLR0QA' // also truncated for brevity

}

export const mockKycStatusResponse: KycStatusResponse = {
    kycStatus: KycStatus.Pending
}

export const mockFiatAccountSchemaData: FiatAccountSchemaData = {
    bankName: 'Chase',
    accountName: 'Checking Account',
    fiatType: FiatType.USD,
    accountNumber: '12533986',
    routingNumber: '494187652'
}

export const mockAddFiatAccountResponse: AddFiatAccountResponse = {
    fiatAccountId: '12345',
    name: 'Checking Account',
    institution: 'Chase',
    fiatAccountType: FiatAccountType.MockCheckingAccount
}

export const mockGetFiatAccountsResponse: GetFiatAccountsResponse = {
    [FiatAccountSchema.MockCheckingAccount]: [mockAddFiatAccountResponse]
}

export const mockDeleteFiatAccountParams: DeleteFiatAccountRequestParams = {
    fiatAccountId: '12358'
}

export const mockTransferRequestBody: TransferRequestBody = {
    fiatType: FiatType.USD,
    cryptoType: CryptoType.cUSD,
    amount: '5.0',
    fiatAccountId: '12358'
}

export const mockTransferResponse: TransferResponse = {
    transferId: '82938',
    transferStatus: TransferStatus.TransferPending,
    transferAddress: '0xCC6DDE7638B2409e120e915adD948069CA619e10'
}

export const mockTransferStatusRequestParams: TransferStatusRequestParams = {
    transferId: '82938'
}

export const mockTransferStatusResponse: TransferStatusResponse = {
    status: TransferStatus.TransferComplete,
    transferType: TransferType.TransferIn,
    fiatType: FiatType.USD,
    cryptoType: CryptoType.cUSD,
    amountProvided: '5.0',
    amountReceived: '5.0',
    fiatAccountId: '12358'
}