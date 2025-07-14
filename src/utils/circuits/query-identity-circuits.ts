import { NoirCircuitParams } from '@modules/noir'
import NoirModule from '@modules/noir/src/NoirModule'
import { Name, TBSCertificate } from '@peculiar/asn1-x509'

const PRIME = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

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

  buildDg1FromTbs(tbs: TBSCertificate): number[] {
    const dg1 = new Uint8Array(108)
    const encoder = new TextEncoder()

    // (1) Country Code
    const countryName = this._getAttributeValue(tbs.issuer, '2.5.4.6') ?? ''
    const countryBytes = encoder.encode(countryName)
    dg1[0] = countryBytes[0] || 0
    dg1[1] = countryBytes[1] || 0

    // (2) Validity
    const encodeDate = (date: Date): Uint8Array => {
      const str = date.toISOString().slice(2, 15).replace(/[-T:]/g, '') // YYMMDDhhmmssZ
      return encoder.encode(str)
    }

    const notBefore = encodeDate(tbs.validity.notBefore.getTime())
    const notAfter = encodeDate(tbs.validity.notAfter.getTime())

    dg1.set(notBefore.slice(0, 13), 2)
    dg1.set(notAfter.slice(0, 13), 15)

    // (3) Given Name
    const givenName = encoder.encode(this._getAttributeValue(tbs.subject, '2.5.4.42') ?? '')
    dg1.set(givenName.slice(0, 30), 28)
    dg1[58] = givenName.length

    // (4) Surname
    const surname = encoder.encode(this._getAttributeValue(tbs.subject, '2.5.4.4') ?? '')
    dg1.set(surname.slice(0, 30), 59)
    dg1[89] = surname.length

    // (5) Common Name
    const commonName = encoder.encode(this._getAttributeValue(tbs.subject, '2.5.4.3') ?? '')
    dg1.set(commonName.slice(0, 18), 90)

    return Array.from(dg1)
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
  }: {
    icaoRoot: string
    skIdentity: string
    pkPassportHash: string
    dg1: number[]
    inclusionBranches: string[]
  }) {
    const now = Math.floor(Date.now() / 1_000)
    const oneDay = 24 * 60 * 60

    return {
      event_id: this._getRandomDecimal(),
      event_data: this._getRandomDecimal(),
      id_state_root: icaoRoot,
      selector: '262143',
      timestamp_lowerbound: (now - oneDay).toString(),
      timestamp_upperbound: (now + oneDay).toString(),
      timestamp: now.toString(),
      identity_counter: '1',
      identity_count_lowerbound: '0',
      identity_count_upperbound:
        '21888242871839275222246405745257275088548364400416034343698204186575808495616',
      birth_date_lowerbound: '0',
      birth_date_upperbound: '0',
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
