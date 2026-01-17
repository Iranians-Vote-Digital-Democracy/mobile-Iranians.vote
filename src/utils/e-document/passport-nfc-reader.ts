/**
 * Passport NFC Reader
 *
 * High-level API for reading e-Passport data via NFC and creating
 * EPassport objects for use with the registration flow.
 */

import {
  BACKeyParams,
  calculateMRZCheckDigit,
  formatDateForMRZ,
  initPassportNfc,
  isNfcEnabled,
  parseMRZDate,
  PassportReadResult,
  readPassport as nativeReadPassport,
  stopNfc,
} from '@modules/passport-reader'

import { EPassport, PersonDetails } from './e-document'

export {
  calculateMRZCheckDigit,
  formatDateForMRZ,
  initPassportNfc,
  isNfcEnabled,
  parseMRZDate,
  stopNfc as stopPassportNfc,
}

export type MRZData = {
  documentNumber: string
  dateOfBirth: string // YYMMDD format
  dateOfExpiry: string // YYMMDD format
  documentCode?: string
}

/**
 * Parse MRZ text lines to extract document details
 * Supports TD1 (ID cards), TD2, and TD3 (passports) formats
 */
export function parseMRZLines(lines: string[]): MRZData | null {
  if (lines.length < 2) return null

  // Remove whitespace and normalize
  const cleanLines = lines.map(l => l.trim().toUpperCase().replace(/\s/g, ''))

  // TD3 format (passport) - 2 lines of 44 characters
  if (cleanLines.length >= 2 && cleanLines[0].length >= 44 && cleanLines[1].length >= 44) {
    const line2 = cleanLines[1]
    return {
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      dateOfBirth: line2.substring(13, 19),
      dateOfExpiry: line2.substring(21, 27),
      documentCode: cleanLines[0].substring(0, 2).replace(/</g, ''),
    }
  }

  // TD1 format (ID card) - 3 lines of 30 characters
  if (cleanLines.length >= 3 && cleanLines[0].length >= 30) {
    const line1 = cleanLines[0]
    const line2 = cleanLines[1]
    return {
      documentNumber: line1.substring(5, 14).replace(/</g, ''),
      dateOfBirth: line2.substring(0, 6),
      dateOfExpiry: line2.substring(8, 14),
      documentCode: line1.substring(0, 2).replace(/</g, ''),
    }
  }

  // TD2 format - 2 lines of 36 characters
  if (cleanLines.length >= 2 && cleanLines[0].length >= 36 && cleanLines[1].length >= 36) {
    const line2 = cleanLines[1]
    return {
      documentNumber: line2.substring(0, 9).replace(/</g, ''),
      dateOfBirth: line2.substring(13, 19),
      dateOfExpiry: line2.substring(21, 27),
      documentCode: cleanLines[0].substring(0, 2).replace(/</g, ''),
    }
  }

  return null
}

/**
 * Convert native passport read result to PersonDetails
 */
function toPersonDetails(result: PassportReadResult): PersonDetails {
  const pd = result.personDetails
  return {
    firstName: pd.firstName,
    lastName: pd.lastName,
    gender: pd.gender,
    birthDate: pd.dateOfBirth,
    expiryDate: pd.dateOfExpiry,
    documentNumber: pd.documentNumber,
    nationality: pd.nationality,
    issuingAuthority: pd.issuingAuthority,
    passportImageRaw: null, // We don't store the face image for privacy
  }
}

const log = (...args: unknown[]) => console.warn('[PASSPORT-NFC]', ...args)

/**
 * Read passport via NFC and return an EPassport object
 *
 * @param mrzData - MRZ data extracted from scanning the passport
 * @param challenge - Optional challenge for Active Authentication (hex encoded)
 * @returns EPassport object ready for registration
 */
export async function scanPassport(mrzData: MRZData, challenge?: Uint8Array): Promise<EPassport> {
  log('Starting passport scan...')
  log('MRZ data:', {
    documentNumber: mrzData.documentNumber,
    dateOfBirth: mrzData.dateOfBirth,
    dateOfExpiry: mrzData.dateOfExpiry,
  })

  // Initialize NFC if not already done
  log('Initializing NFC...')
  await initPassportNfc()
  log('NFC initialized')

  const bacParams: BACKeyParams = {
    documentNumber: mrzData.documentNumber,
    dateOfBirth: mrzData.dateOfBirth,
    dateOfExpiry: mrzData.dateOfExpiry,
  }

  const challengeHex = challenge ? Buffer.from(challenge).toString('hex') : undefined
  log('BAC params prepared, challenge:', challengeHex ? 'provided' : 'none')

  // Read passport via NFC
  log('Reading passport via NFC... (hold passport to phone)')
  const result = await nativeReadPassport(bacParams, challengeHex)
  log('Passport read complete!')

  const dg = result.dataGroups
  log('Person details:', {
    firstName: result.personDetails.firstName,
    lastName: result.personDetails.lastName,
    nationality: result.personDetails.nationality,
    documentNumber: result.personDetails.documentNumber,
  })
  log('Data groups received:', {
    sod: dg.sod ? `${dg.sod.length} hex chars` : 'missing',
    dg1: dg.dg1 ? `${dg.dg1.length} hex chars` : 'missing',
    dg15: dg.dg15 ? `${dg.dg15.length} hex chars` : 'not present',
    dg11: dg.dg11 ? `${dg.dg11.length} hex chars` : 'not present',
  })
  log(
    'AA signature:',
    result.aaSignature ? `${result.aaSignature.length} hex chars` : 'not present',
  )

  // Convert hex strings to Uint8Array
  const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
  }

  // Create EPassport object
  log('Creating EPassport object...')
  const ePassport = new EPassport({
    docCode: result.personDetails.documentCode || 'P',
    personDetails: toPersonDetails(result),
    sodBytes: hexToBytes(dg.sod),
    dg1Bytes: hexToBytes(dg.dg1),
    dg15Bytes: dg.dg15 ? hexToBytes(dg.dg15) : undefined,
    dg11Bytes: dg.dg11 ? hexToBytes(dg.dg11) : undefined,
    aaSignature: result.aaSignature ? hexToBytes(result.aaSignature) : undefined,
  })
  log('EPassport created successfully')

  return ePassport
}

/**
 * Scan passport with automatic MRZ parsing from camera
 * This is a convenience function that combines camera MRZ scanning with NFC reading
 */
export async function scanPassportWithMRZ(
  mrzLines: string[],
  challenge?: Uint8Array,
): Promise<EPassport> {
  const mrzData = parseMRZLines(mrzLines)
  if (!mrzData) {
    throw new Error('Failed to parse MRZ data from provided lines')
  }

  return scanPassport(mrzData, challenge)
}

/**
 * Validate MRZ check digits
 * Returns true if all check digits are valid
 */
export function validateMRZCheckDigits(
  documentNumber: string,
  documentNumberCheckDigit: number,
  dateOfBirth: string,
  dateOfBirthCheckDigit: number,
  dateOfExpiry: string,
  dateOfExpiryCheckDigit: number,
): boolean {
  return (
    calculateMRZCheckDigit(documentNumber) === documentNumberCheckDigit &&
    calculateMRZCheckDigit(dateOfBirth) === dateOfBirthCheckDigit &&
    calculateMRZCheckDigit(dateOfExpiry) === dateOfExpiryCheckDigit
  )
}

/**
 * Create BAC key string from MRZ data
 * Format used by JMRTD: documentNumber + checkDigit + dateOfBirth + checkDigit + dateOfExpiry + checkDigit
 */
export function createBACKeyString(mrzData: MRZData): string {
  const docNum = mrzData.documentNumber.padEnd(9, '<')
  const docNumCheck = calculateMRZCheckDigit(docNum)
  const dobCheck = calculateMRZCheckDigit(mrzData.dateOfBirth)
  const doeCheck = calculateMRZCheckDigit(mrzData.dateOfExpiry)

  return `${docNum}${docNumCheck}${mrzData.dateOfBirth}${dobCheck}${mrzData.dateOfExpiry}${doeCheck}`
}
