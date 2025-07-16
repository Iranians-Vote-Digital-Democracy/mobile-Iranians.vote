import { NoirCircuitParams } from '@modules/noir'
import NoirModule from '@modules/noir/src/NoirModule'
import { QueryParams } from 'expo-linking'
import { Platform } from 'react-native'

import { QUERY_PARAMS_ALIASES, QueryProofParams } from './types/QueryIdentity'

const PRIME = '21888242871839275222246405745257275088548364400416034343698204186575808495617'
const DEFAULT_MASK_HEX = '0x20000000000000000000000000' // Iran mask

/**
 * Builds and proves the Query Identity circuit.
 */
export class QueryIdentityCircuit {
  public circuitParams: NoirCircuitParams

  constructor() {
    this.circuitParams = NoirCircuitParams.fromName('queryIdentity_inid_ca')
  }

  /**
   * Generates a ZK proof given serialized inputs.
   */
  async prove(serializedInputs: string) {
    const [byteCode, setupUri] = await Promise.all([
      this.circuitParams.downloadByteCode(),
      NoirCircuitParams.getTrustedSetupUri(),
    ])
    if (!setupUri) {
      throw new Error('Trusted setup URI missing')
    }
    const proof = await NoirModule.provePlonk(setupUri, serializedInputs, byteCode)
    if (!proof) {
      throw new Error(`Proof generation failed for circuit ${this.circuitParams.name}`)
    }
    return proof
  }

  /**
   * Constructs circuit inputs in the correct format for the current platform.
   */
  buildQueryProofParams(params: QueryProofParams = {}) {
    const useHex = Platform.OS === 'android'
    const toHex = (v: string) => this.ensureHexPrefix(BigInt(v).toString(16))
    const toDec = (v: string) => BigInt(v).toString(10)
    const fmt = (v: string | undefined, def: string) => (useHex ? toHex(v ?? def) : toDec(v ?? def))

    const formatArray = (arr: string[] = []) =>
      arr.map(item =>
        useHex ? this.ensureHexPrefix(BigInt(item).toString(16)) : BigInt(item).toString(10),
      )

    return {
      event_id: fmt(params.eventId, this.getRandomHex()),
      event_data: fmt(params.eventData, this.getRandomDecimal()),
      id_state_root: fmt(params.idStateRoot, '0'),
      selector: fmt(params.selector, '262143'),
      timestamp_lowerbound: fmt(params.timestampLower, '0'),
      timestamp_upperbound: fmt(params.timestampUpper, PRIME.toString()),
      timestamp: fmt(params.timestamp, '0'),
      identity_counter: fmt(params.identityCounter, '0'),
      identity_count_lowerbound: fmt(params.identityCountLower, '0'),
      identity_count_upperbound: fmt(params.identityCountUpper, PRIME.toString()),
      birth_date_lowerbound: fmt(params.birthDateLower, '0'),
      birth_date_upperbound: fmt(params.birthDateUpper, PRIME.toString()),
      expiration_date_lowerbound: fmt(params.expirationDateLower, '0'),
      expiration_date_upperbound: fmt(params.expirationDateUpper, PRIME.toString()),
      citizenship_mask: fmt(params.citizenshipMask, DEFAULT_MASK_HEX),
      sk_identity: fmt(params.skIdentity, '0'),
      pk_passport_hash: fmt(params.pkPassportHash, '0'),
      dg1: formatArray(params.dg1),
      siblings: formatArray(params.siblings),
    }
  }

  /**
   * Extracts and normalizes query parameters from the provided URL parameters.
   * For each camelCase key defined in QUERY_PARAMS_ALIASES, this method:
   * 1. Checks its list of possible aliases (snake_case or camelCase) against the incoming params.
   * 2. Finds the first alias that exists in paramsFromUrl.
   * 3. Converts the found value to a string and assigns it under the camelCase key.
   *
   * Returns a Partial<QueryProofParams> containing only the parameters present in the URL.
   */
  public static extractQueryProofParams(paramsFromUrl: QueryParams): Partial<QueryProofParams> {
    const result: Partial<QueryProofParams> = {}

    Object.entries(QUERY_PARAMS_ALIASES).forEach(([camelKey, aliases]) => {
      const foundedKey = aliases.find(alias => paramsFromUrl[alias])
      if (foundedKey) result[camelKey] = String(paramsFromUrl[foundedKey])
    })

    return result
  }

  private ensureHexPrefix(val: string): string {
    return val.startsWith('0x') ? val : `0x${val}`
  }

  private getRandomDecimal(bits = 250): string {
    const rand = this.randomBigInt(bits)
    return (rand % BigInt(PRIME)).toString(10)
  }

  private getRandomHex(bits = 250): string {
    const rand = this.randomBigInt(bits)
    return this.ensureHexPrefix((rand % BigInt(PRIME)).toString(16))
  }

  private randomBigInt(bits: number): bigint {
    const bytes = Math.ceil(bits / 8)
    const arr = new Uint8Array(bytes)
    crypto.getRandomValues(arr)
    return BigInt(
      '0x' +
        Array.from(arr)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''),
    )
  }

  getDg1(tbsByes: Uint8Array): Uint8Array {
    const { country_name, validity, given_name, surname, common_name } = this._parseRawTbs(tbsByes)
    const dg1 = new Uint8Array(108)

    dg1[0] = country_name[0]
    dg1[1] = country_name[1]

    for (let j = 0; j < 13; j++) {
      dg1[j + 2] = validity[0][j]
      dg1[j + 15] = validity[1][j]
    }

    for (let j = 0; j < 31; j++) {
      dg1[j + 28] = given_name[j]
      dg1[j + 59] = surname[j]
    }

    for (let j = 0; j < 18; j++) {
      dg1[j + 90] = common_name[j]
    }

    return dg1
  }

  private _parseRawTbs(tbsByes: Uint8Array) {
    let current_offset = 28
    current_offset += tbsByes[current_offset] + 1
    current_offset += tbsByes[current_offset + 1] + 2

    const validity_len = tbsByes[current_offset + 3]
    const validity: [Uint8Array, Uint8Array] = [new Uint8Array(16), new Uint8Array(16)]

    for (let i = 0; i < 16; i++) {
      if (i < validity_len) {
        validity[0][i] = tbsByes[current_offset + 4 + i]
        validity[1][i] = tbsByes[current_offset + 6 + validity_len + i]
      }
    }

    validity[0][15] = validity_len
    validity[1][15] = validity_len

    current_offset += tbsByes[current_offset + 1] + 2

    const country_name = new Uint8Array(2)
    country_name[0] = tbsByes[current_offset + 13]
    country_name[1] = tbsByes[current_offset + 14]

    current_offset += tbsByes[current_offset + 3] + 4
    current_offset += tbsByes[current_offset + 1] + 2
    current_offset += 7 + tbsByes[current_offset + 5]

    const given_name = new Uint8Array(31)
    const given_name_len = tbsByes[current_offset]
    for (let i = 0; i < 30; i++) {
      if (i < given_name_len) {
        given_name[i] = tbsByes[current_offset + 1 + i]
      }
    }

    given_name[30] = given_name_len
    current_offset += given_name_len + 1

    current_offset += 7 + tbsByes[current_offset + 5]

    const surname = new Uint8Array(31)
    const surname_len = tbsByes[current_offset]
    for (let i = 0; i < 30; i++) {
      if (i < surname_len) {
        surname[i] = tbsByes[current_offset + 1 + i]
      }
    }
    surname[30] = surname_len
    current_offset += surname_len + 1

    current_offset += 7 + tbsByes[current_offset + 5]

    const common_name = new Uint8Array(31)
    const common_name_len = tbsByes[current_offset]
    for (let i = 0; i < 30; i++) {
      if (i < common_name_len) {
        common_name[i] = tbsByes[current_offset + 1 + i]
      }
    }
    common_name[30] = common_name_len

    return {
      country_name,
      validity,
      given_name,
      surname,
      common_name,
    }
  }
}
