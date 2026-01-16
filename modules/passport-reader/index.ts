import PassportReaderModule from './src/PassportReaderModule'

const log = (...args: unknown[]) => console.warn('[PASSPORT-NATIVE]', ...args)

export type BACKeyParams = {
  dateOfBirth: string // YYMMDD format
  dateOfExpiry: string // YYMMDD format
  documentNumber: string
}

export type PassportDataGroups = {
  dg1: string // hex encoded
  dg2Hash: string // hex encoded hash of DG2 (face image)
  dg15?: string // hex encoded (Active Authentication public key)
  dg11?: string // hex encoded (additional document holder details)
  sod: string // hex encoded Security Object Document
}

export type PassportPersonDetails = {
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

export type PassportReadResult = {
  personDetails: PassportPersonDetails
  dataGroups: PassportDataGroups
  aaSignature?: string // hex encoded Active Authentication signature (if challenge provided)
}

/**
 * Initialize NFC for passport reading
 */
export async function initPassportNfc(): Promise<boolean> {
  log('initNfc called')
  const result = await PassportReaderModule.initNfc()
  log('initNfc result:', result)
  return result
}

/**
 * Check if NFC is available and enabled on the device
 */
export async function isNfcEnabled(): Promise<boolean> {
  log('isNfcEnabled called')
  const result = await PassportReaderModule.isNfcEnabled()
  log('isNfcEnabled result:', result)
  return result
}

/**
 * Read passport data using NFC
 * @param bacParams - BAC (Basic Access Control) parameters from MRZ
 * @param challenge - Optional challenge for Active Authentication signature
 * @returns Passport data including person details and data groups
 */
export async function readPassport(
  bacParams: BACKeyParams,
  challenge?: string, // hex encoded challenge for AA
): Promise<PassportReadResult> {
  log('readPassport called with:', {
    documentNumber: bacParams.documentNumber,
    dateOfBirth: bacParams.dateOfBirth,
    dateOfExpiry: bacParams.dateOfExpiry,
    hasChallenge: !!challenge,
  })

  try {
    const result = await PassportReaderModule.readPassport(
      bacParams.documentNumber,
      bacParams.dateOfBirth,
      bacParams.dateOfExpiry,
      challenge ?? null,
    )
    log('readPassport SUCCESS')
    log('personDetails:', result.personDetails)
    log('dataGroups keys:', Object.keys(result.dataGroups))
    return result
  } catch (error) {
    log('readPassport ERROR:', error)
    throw error
  }
}

/**
 * Stop/cancel ongoing NFC session
 */
export async function stopNfc(): Promise<void> {
  return PassportReaderModule.stopNfc()
}

/**
 * Calculate MRZ check digit
 */
export function calculateMRZCheckDigit(input: string): number {
  const weights = [7, 3, 1]
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<'
  let sum = 0

  for (let i = 0; i < input.length; i++) {
    const char = input.charAt(i).toUpperCase()
    const value = chars.indexOf(char)
    if (value === -1) continue
    sum += value * weights[i % 3]
  }

  return sum % 10
}

/**
 * Format date for MRZ (YYMMDD)
 */
export function formatDateForMRZ(date: Date): string {
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Parse MRZ date (YYMMDD) to Date object
 */
export function parseMRZDate(mrzDate: string): Date {
  const year = parseInt(mrzDate.slice(0, 2), 10)
  const month = parseInt(mrzDate.slice(2, 4), 10) - 1
  const day = parseInt(mrzDate.slice(4, 6), 10)

  // Determine century: if year > 50, assume 1900s, otherwise 2000s
  const fullYear = year > 50 ? 1900 + year : 2000 + year

  return new Date(fullYear, month, day)
}
