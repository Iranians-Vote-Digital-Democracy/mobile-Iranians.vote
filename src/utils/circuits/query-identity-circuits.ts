/* eslint-disable unused-imports/no-unused-vars */
import { NoirCircuitParams } from '@modules/noir'
import NoirModule from '@modules/noir/src/NoirModule'
import { Name } from '@peculiar/asn1-x509'

const PRIME = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

type ParsedFields = {
  country_name: Uint8Array
  validity: [Uint8Array, Uint8Array]
  given_name: Uint8Array
  surname: Uint8Array
  common_name: Uint8Array
}

export class QueryIdentityCircuit {
  public circuitParams: NoirCircuitParams

  static TEST_DATA = {
    event_id: '0x123',
    event_data: '0x123321',
    id_state_root: '0x2e364a232db953191a2b3fe96fac9f44cfc7672ff2740666b61acde3304be2de',
    selector: '262143',
    timestamp_lowerbound: '1000',
    timestamp_upperbound: '2000',
    timestamp: '1500',
    identity_count_lowerbound: '0',
    identity_count_upperbound: '5',
    identity_counter: '1',
    birth_date_lowerbound: '0',
    birth_date_upperbound: '0',
    expiration_date_lowerbound: '0',
    expiration_date_upperbound:
      '21888242871839275222246405745257275088548364400416034343698204186575808495616',
    citizenship_mask: '0x20000000000000000000000000',
    sk_identity: '0x1234567890',
    pk_passport_hash: '0x03a26b3d1c4155149447a34600cd510e48202e3ebf5eeb5487d688fb21cf1e8a',
    dg1: [
      73, 82, 49, 54, 48, 56, 48, 55, 48, 48, 48, 48, 48, 48, 90, 50, 51, 48, 56, 48, 55, 48, 48,
      48, 48, 48, 48, 90, 216, 179, 219, 140, 217, 134, 216, 167, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 216, 181, 217, 129, 216, 167, 216, 166, 219, 140, 32, 217,
      130, 216, 167, 216, 175, 216, 177, 219, 140, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 48, 48, 56, 48,
      49, 54, 54, 48, 55, 53, 32, 45, 32, 83, 73, 71, 0, 0,
    ],
    siblings: new Array(82).fill('0x00'),
  }

  parseRawTbs(asn1: Uint8Array): ParsedFields {
    let current_offset = 28

    current_offset += asn1[current_offset]! + 1
    current_offset += asn1[current_offset + 1]! + 2

    const validity_len = asn1[current_offset + 3]!
    const validity: [Uint8Array, Uint8Array] = [new Uint8Array(16), new Uint8Array(16)]

    for (let i = 0; i < 16; i++) {
      if (i < validity_len) {
        validity[0][i] = asn1[current_offset + 4 + i]!
        validity[1][i] = asn1[current_offset + 6 + validity_len + i]!
      }
    }

    validity[0][15] = validity_len
    validity[1][15] = validity_len

    current_offset += asn1[current_offset + 1]! + 2

    const country_name = new Uint8Array(2)
    country_name[0] = asn1[current_offset + 13]!
    country_name[1] = asn1[current_offset + 14]!

    current_offset += asn1[current_offset + 3]! + 4
    current_offset += asn1[current_offset + 1]! + 2
    current_offset += 7 + asn1[current_offset + 5]!

    const given_name = new Uint8Array(31)
    const given_name_len = asn1[current_offset]!
    for (let i = 0; i < 30; i++) {
      if (i < given_name_len) {
        given_name[i] = asn1[current_offset + 1 + i]!
      }
    }
    given_name[30] = given_name_len
    current_offset += given_name_len + 1

    current_offset += 7 + asn1[current_offset + 5]!

    const surname = new Uint8Array(31)
    const surname_len = asn1[current_offset]!
    for (let i = 0; i < 30; i++) {
      if (i < surname_len) {
        surname[i] = asn1[current_offset + 1 + i]!
      }
    }
    surname[30] = surname_len
    current_offset += surname_len + 1

    current_offset += 7 + asn1[current_offset + 5]!

    const common_name = new Uint8Array(31)
    const common_name_len = asn1[current_offset]!
    for (let i = 0; i < 30; i++) {
      if (i < common_name_len) {
        common_name[i] = asn1[current_offset + 1 + i]!
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

  getDg1(asn1: Uint8Array): Uint8Array {
    const { country_name, validity, given_name, surname, common_name } = this.parseRawTbs(asn1)
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

  private _getAttributeValue(name: Name, oid: string): string | undefined {
    for (const rdn of name) {
      for (const attr of rdn) {
        if (attr.type === oid) {
          return attr.value.toString()
        }
      }
    }
    return undefined
  }

  private _ensureHexPrefix(val: string) {
    return val.startsWith('0x') ? val : `0x${val}`
  }

  private _getRandomDecimal(bits = 250): string {
    const bytes = Math.ceil(bits / 8)
    const array = new Uint8Array(bytes)
    crypto.getRandomValues(array)
    const bigIntVal = BigInt(
      '0x' +
        Array.from(array)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''),
    )
    return (bigIntVal % PRIME).toString(10)
  }

  private _getRandomHex(bits = 250) {
    const bytes = Math.ceil(bits / 8)
    const array = new Uint8Array(bytes)
    crypto.getRandomValues(array)
    const bigIntVal = BigInt(
      '0x' +
        Array.from(array)
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''),
    )
    return '0x' + (bigIntVal % PRIME).toString(16)
  }

  buildInputs({
    icaoRoot,
    skIdentity,
    pkPassportHash,
    dg1,
    inclusionBranches,
    timestamp,
    identityCounter,
  }: {
    icaoRoot: string
    skIdentity: string
    pkPassportHash: string
    dg1: number[]
    timestamp: string
    inclusionBranches: string[]
    identityCounter: string
  }) {
    const now = Math.floor(Date.now() / 1_000)
    const oneDay = 24 * 60 * 60

    return {
      event_id: this._getRandomDecimal(),
      event_data: this._getRandomDecimal(),
      id_state_root: icaoRoot,
      selector: '262143',
      timestamp_lowerbound: '0',
      timestamp_upperbound:
        '21888242871839275222246405745257275088548364400416034343698204186575808495616',
      timestamp,
      // timestamp_lowerbound: (now - oneDay).toString(),
      // timestamp_upperbound: (now + oneDay).toString(),
      // timestamp: now.toString(),
      identity_counter: identityCounter,
      identity_count_lowerbound: '0',
      identity_count_upperbound:
        '21888242871839275222246405745257275088548364400416034343698204186575808495616',
      birth_date_lowerbound: '0',
      birth_date_upperbound:
        '21888242871839275222246405745257275088548364400416034343698204186575808495616',
      expiration_date_lowerbound: '0',
      expiration_date_upperbound:
        '21888242871839275222246405745257275088548364400416034343698204186575808495616',
      citizenship_mask: '0x20000000000000000000000000',
      sk_identity: skIdentity,
      pk_passport_hash: this._ensureHexPrefix(pkPassportHash),
      dg1,
      siblings: inclusionBranches,
    }
  }

  constructor() {
    this.circuitParams = NoirCircuitParams.fromName('queryIdentity_inid_ca')
  }

  async prove(inputs: string) {
    const byteCodeString = await this.circuitParams.downloadByteCode()
    const trustedSetupUri = await NoirCircuitParams.getTrustedSetupUri()

    if (!trustedSetupUri) {
      throw new Error('Trusted setup not found. Please download it first.')
    }

    const proof = await NoirModule.provePlonk(trustedSetupUri, inputs, byteCodeString)

    if (!proof) {
      throw new Error(`Failed to generate proof for noir circuit ${this.circuitParams.name}`)
    }

    console.log('proof', proof)
    return proof
  }
}
