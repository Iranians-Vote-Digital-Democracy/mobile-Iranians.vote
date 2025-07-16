import { Groth16Proof, Groth16ProofPoints, NumberLike, NumericString } from '@solarity/zkit'

export type PrivateQueryIdentityGroth16 = {
  eventID: NumberLike
  eventData: NumberLike
  idStateRoot: NumberLike
  selector: NumberLike
  currentDate: NumberLike
  timestampLowerbound: NumberLike
  timestampUpperbound: NumberLike
  identityCounterLowerbound: NumberLike
  identityCounterUpperbound: NumberLike
  birthDateLowerbound: NumberLike
  birthDateUpperbound: NumberLike
  expirationDateLowerbound: NumberLike
  expirationDateUpperbound: NumberLike
  citizenshipMask: NumberLike
  skIdentity: NumberLike
  pkPassportHash: NumberLike
  dg1: NumberLike[]
  idStateSiblings: NumberLike[]
  timestamp: NumberLike
  identityCounter: NumberLike
}

export type PublicQueryIdentityGroth16 = {
  nullifier: NumberLike
  birthDate: NumberLike
  expirationDate: NumberLike
  name: NumberLike
  nameResidual: NumberLike
  nationality: NumberLike
  citizenship: NumberLike
  sex: NumberLike
  documentNumber: NumberLike
  eventID: NumberLike
  eventData: NumberLike
  idStateRoot: NumberLike
  selector: NumberLike
  currentDate: NumberLike
  timestampLowerbound: NumberLike
  timestampUpperbound: NumberLike
  identityCounterLowerbound: NumberLike
  identityCounterUpperbound: NumberLike
  birthDateLowerbound: NumberLike
  birthDateUpperbound: NumberLike
  expirationDateLowerbound: NumberLike
  expirationDateUpperbound: NumberLike
  citizenshipMask: NumberLike
}

export type ProofQueryIdentityGroth16 = {
  proof: Groth16Proof
  publicSignals: PublicQueryIdentityGroth16
}

export type CalldataQueryIdentityGroth16 = {
  proofPoints: Groth16ProofPoints
  publicSignals: [
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
    NumericString,
  ]
}

/**
 * Proof input parameters for QueryIdentityCircuit.
 */
export interface QueryProofParams {
  eventId?: string
  eventData?: string
  idStateRoot?: string
  selector?: string
  timestampLower?: string
  timestampUpper?: string
  timestamp?: string
  identityCounter?: string
  identityCountLower?: string
  identityCountUpper?: string
  birthDateLower?: string
  birthDateUpper?: string
  expirationDateLower?: string
  expirationDateUpper?: string
  citizenshipMask?: string
  skIdentity?: string
  pkPassportHash?: string
  dg1?: string[] // array of byte values as strings
  siblings?: string[] // array of branch nodes
}

export type QueryKeysFromUrl =
  | 'eventId'
  | 'eventData'
  | 'selector'
  | 'citizenshipMask'
  | 'timestampLower'
  | 'timestampUpper'
  | 'timestamp'
  | 'identityCounter'
  | 'identityCountLower'
  | 'identityCountUpper'
  | 'birthDateLower'
  | 'birthDateUpper'
  | 'expirationDateLower'
  | 'expirationDateUpper'

// Mapping from camelCase to possible variants of query params from url
export const QUERY_PARAMS_ALIASES: Record<QueryKeysFromUrl, string[]> = {
  eventId: ['eventId', 'event_id'],
  eventData: ['eventData', 'event_data'],
  selector: ['selector'],
  citizenshipMask: ['citizenshipMask', 'citizenship_mask'],
  timestampLower: ['timestampLower', 'timestamp_lower'],
  timestampUpper: ['timestampUpper', 'timestamp_upper'],
  timestamp: ['timestamp'],
  identityCounter: ['identityCounter', 'identity_counter'],
  identityCountLower: ['identityCountLower', 'identity_count_lower'],
  identityCountUpper: ['identityCountUpper', 'identity_count_upper'],
  birthDateLower: ['birthDateLower', 'birth_date_lower'],
  birthDateUpper: ['birthDateUpper', 'birth_date_upper'],
  expirationDateLower: ['expirationDateLower', 'expiration_date_lower'],
  expirationDateUpper: ['expirationDateUpper', 'expiration_date_upper'],
}

/**
 * Subset of QueryProofParams allowed to be supplied via URL
 */
export type UrlQueryProofParams = Pick<QueryProofParams, QueryKeysFromUrl>
