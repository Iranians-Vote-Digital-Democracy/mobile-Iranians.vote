import { NoirCircuitParams } from '@modules/noir'

import { EID } from '@/utils/e-document/e-document'

import { ZKProof } from '../types/common'

export class InidNoirRegistrationCircuit {
  constructor(public eID: EID) {}

  public get noirCircuitParams(): NoirCircuitParams {
    return NoirCircuitParams.fromName('inid_noir_circuit')
  }

  async prove(params: {
    skIdentity: bigint
    icaoRoot: bigint
    inclusionBranches: bigint[]
  }): Promise<ZKProof> {
    await NoirCircuitParams.downloadTrustedSetup()

    const byteCode = await this.noirCircuitParams.downloadByteCode()

    const inputs = {
      sk_identity: params.skIdentity,
      icao_root: params.icaoRoot,
      inclusion_branches: params.inclusionBranches,
    }

    const proof = await this.noirCircuitParams.prove(JSON.stringify(inputs), byteCode)

    return JSON.parse(proof) as ZKProof
  }
}
