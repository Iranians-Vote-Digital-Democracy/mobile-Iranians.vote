import { NativeModule, requireNativeModule } from 'expo'

declare class PassportReaderModuleType extends NativeModule {
  initNfc(): Promise<boolean>
  isNfcEnabled(): Promise<boolean>
  readPassport(
    documentNumber: string,
    dateOfBirth: string,
    dateOfExpiry: string,
    challenge: string | null,
  ): Promise<{
    personDetails: {
      firstName: string
      lastName: string
      gender: string
      dateOfBirth: string
      dateOfExpiry: string
      documentNumber: string
      nationality: string
      issuingAuthority: string
      documentCode: string
    }
    dataGroups: {
      dg1: string
      dg2Hash: string
      dg15?: string
      dg11?: string
      sod: string
    }
    aaSignature?: string
  }>
  stopNfc(): Promise<void>
}

export default requireNativeModule<PassportReaderModuleType>('PassportReader')
