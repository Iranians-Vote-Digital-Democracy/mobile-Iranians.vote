import { NoirCircuitParams, NoirZKProof } from '@modules/noir'
import { AsnConvert } from '@peculiar/asn1-schema'
import { getBytes, toBigInt, zeroPadBytes } from 'ethers'

import { tryCatch } from '@/helpers/try-catch'
import { EID } from '@/utils/e-document/e-document'
import { extractRawPubKey } from '@/utils/e-document/helpers/misc'

import { CircomRegistrationCircuit } from './circom-registration-circuit'
import { NoirRegistrationCircuit } from './noir-registration-circuit'

export class InidNoirRegistrationCircuit {
  constructor(public eID: EID) {}

  public get noirCircuitParams(): NoirCircuitParams {
    return NoirCircuitParams.fromName('registerIdentity_inid_ca')
  }

  async prove(params: {
    skIdentity: bigint
    icaoRoot: bigint
    inclusionBranches: bigint[]
  }): Promise<NoirZKProof> {
    await NoirCircuitParams.downloadTrustedSetup()

    const byteCode = await this.noirCircuitParams.downloadByteCode()

    const pubKey = extractRawPubKey(this.eID.authCertificate.certificate)

    const tbsRaw = AsnConvert.serialize(this.eID.sigCertificate.certificate.tbsCertificate)

    const inputs = {
      tbs: Array.from(getBytes(zeroPadBytes(new Uint8Array(tbsRaw), 1200))).map(String),
      pk: CircomRegistrationCircuit.splitBigIntToChunks(120, 18, toBigInt(pubKey)),
      reduction: CircomRegistrationCircuit.splitBigIntToChunks(
        120,
        18,
        NoirRegistrationCircuit.computeBarretReduction(2048 + 2, toBigInt(pubKey)),
      ),
      len: String(tbsRaw.byteLength),
      signature: CircomRegistrationCircuit.splitBigIntToChunks(
        120,
        18,
        toBigInt(new Uint8Array(this.eID.sigCertificate.certificate.signatureValue)),
      ),
      icao_root: String(params.icaoRoot),
      inclusion_branches: params.inclusionBranches.map(String),
      sk_identity: String(params.skIdentity),
    }

    const [proof, getProofError] = await tryCatch(
      this.noirCircuitParams.prove(JSON.stringify(inputs), byteCode),
    )
    if (getProofError) {
      throw getProofError
    }

    return proof
  }
}
