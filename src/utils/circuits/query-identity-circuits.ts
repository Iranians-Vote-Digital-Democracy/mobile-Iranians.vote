import { NoirCircuitParams } from '@modules/noir'
import NoirModule from '@modules/noir/src/NoirModule'

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
    siblings: [
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
    ],
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

    const proof: string = await NoirModule.provePlonk(trustedSetupUri, inputs, byteCodeString)

    if (!proof) {
      throw new Error(`Failed to generate proof for noir circuit ${this.circuitParams.name}`)
    }

    console.log('proof', proof)
    return proof
  }
}
