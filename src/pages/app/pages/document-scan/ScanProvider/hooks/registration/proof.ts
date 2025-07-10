import { groth16ProveWithZKeyFilePath } from '@modules/rapidsnark-wrp'
import type { ZKProof } from '@modules/witnesscalculator'
import { useCallback } from 'react'

import { walletStore } from '@/store/modules/wallet'
import { SparseMerkleTree } from '@/types/contracts/PoseidonSMT'
import { CircomRegistrationCircuit } from '@/utils/circuits/registration/circom-registration-circuit'
import { InidNoirRegistrationCircuit } from '@/utils/circuits/registration/inid-noir-registration-circuit'
import { NoirRegistrationCircuit } from '@/utils/circuits/registration/noir-registration-circuit'

export const useRegistrationIdentityProof = (circuitLoadingOpts: {
  setDownloadingProgress: (progress: string) => void
  setIsLoaded: (isLoaded: boolean) => void
  setIsLoadFailed: (isLoadFailed: boolean) => void
}) => {
  const privateKey = walletStore.useWalletStore(state => state.privateKey)

  const getCircomIdentityRegProof = useCallback(
    async (smtProof: SparseMerkleTree.ProofStructOutput, circuit: CircomRegistrationCircuit) => {
      const { datBytes, zkeyLocalUri } = await circuit.circuitParams.retrieveZkeyNDat({
        onDownloadStart() {},
        onDownloadingProgress(downloadProgressData) {
          circuitLoadingOpts.setDownloadingProgress(
            `${downloadProgressData.totalBytesWritten} / ${downloadProgressData.totalBytesExpectedToWrite}`,
          )
        },
        onFailed(_) {
          circuitLoadingOpts.setIsLoadFailed(true)
        },
        onLoaded() {
          circuitLoadingOpts.setIsLoaded(true)
        },
      })

      const wtns = await circuit.calcWtns(
        {
          skIdentity: BigInt(`0x${privateKey}`),
          slaveMerkleRoot: BigInt(smtProof.root),
          slaveMerkleInclusionBranches: smtProof.siblings.map(el => BigInt(el)),
        },
        datBytes,
      )

      const registerIdentityZkProofBytes = await groth16ProveWithZKeyFilePath(wtns, zkeyLocalUri)

      return JSON.parse(Buffer.from(registerIdentityZkProofBytes).toString()) as ZKProof
    },
    [circuitLoadingOpts, privateKey],
  )

  const getNoirIdentityRegProof = useCallback(
    async (smtProof: SparseMerkleTree.ProofStructOutput, circuit: NoirRegistrationCircuit) => {
      return circuit.prove({
        skIdentity: BigInt(`0x${privateKey}`),
        icaoRoot: BigInt(smtProof.root),
        inclusionBranches: smtProof.siblings.map(el => BigInt(el)),
      })
    },
    [privateKey],
  )

  const getInidNoirIdentityRegProof = useCallback(
    async (smtProof: SparseMerkleTree.ProofStructOutput, circuit: InidNoirRegistrationCircuit) => {
      return circuit.prove({
        skIdentity: BigInt(`0x${privateKey}`),
        icaoRoot: BigInt(smtProof.root),
        inclusionBranches: smtProof.siblings.map(el => BigInt(el)),
      })
    },
    [privateKey],
  )

  return {
    getCircomIdentityRegProof,
    getNoirIdentityRegProof,
    getInidNoirIdentityRegProof,
  }
}
