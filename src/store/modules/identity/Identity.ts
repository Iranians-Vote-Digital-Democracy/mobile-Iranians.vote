import { NoirZKProof } from '@modules/noir'
import type { CircomZKProof } from '@modules/witnesscalculator'
import { getBigInt, JsonRpcProvider, zeroPadValue } from 'ethers'
import SuperJSON from 'superjson'

import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { Config } from '@/config'
import { createStateKeeperContract } from '@/helpers/contracts'
import { EDocument, EPassport } from '@/utils/e-document/e-document'

// TODO: add checking if the passport need to be revoked
export class IdentityItem {
  constructor(
    public document: EDocument,
    public registrationProof: CircomZKProof | NoirZKProof,
  ) {}

  serialize() {
    return SuperJSON.stringify({
      document: this.document.serialize(),
      registrationProof: this.registrationProof,
    })
  }

  static deserialize(serialized: string): IdentityItem {
    const deserialized = SuperJSON.parse<{
      document: string
      registrationProof: CircomZKProof
    }>(serialized)

    return new IdentityItem(
      EDocument.deserialize(deserialized.document),
      deserialized.registrationProof,
    )
  }

  static get stateKeeperContract() {
    return createStateKeeperContract(
      Config.STATE_KEEPER_CONTRACT_ADDRESS,
      new JsonRpcProvider(RARIMO_CHAINS[Config.RMO_CHAIN_ID].rpcEvm),
    )
  }

  get identityKey() {
    return this.registrationProof.pub_signals[3]
  }

  get publicKey() {
    return this.registrationProof.pub_signals[0]
  }
  get passportHash() {
    return this.registrationProof.pub_signals[1]
  }
  get dg1Commitment() {
    return this.registrationProof.pub_signals[2]
  }
  get pkIdentityHash() {
    return this.registrationProof.pub_signals[3]
  }

  async getPassportInfo() {
    try {
      const passportInfoKey = (() => {
        if (this.document instanceof EPassport) {
          return this.document.dg15Bytes?.length ? this.publicKey : this.passportHash
        }

        return this.identityKey.startsWith('0x') ? this.passportHash : '0x' + this.passportHash
      })()

      const passportInfoKeyBytes = zeroPadValue('0x' + getBigInt(passportInfoKey).toString(16), 32)

      return await IdentityItem.stateKeeperContract.contractInstance.getPassportInfo(
        passportInfoKeyBytes,
      )
    } catch (error) {
      console.error('getPassportInfo', error)
      return null
    }
  }
}
