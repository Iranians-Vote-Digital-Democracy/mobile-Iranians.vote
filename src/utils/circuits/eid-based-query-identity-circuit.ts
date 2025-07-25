import { NoirCircuitParams, NoirZKProof } from '@modules/noir'
import { AsnConvert } from '@peculiar/asn1-schema'
import { AbiCoder, JsonRpcProvider, keccak256, toBeHex, toBigInt, zeroPadValue } from 'ethers'
import { Platform } from 'react-native'

import { RARIMO_CHAINS } from '@/api/modules/rarimo'
import { relayerVote } from '@/api/modules/verification/relayer'
import { Config } from '@/config'
import { createNoirIdVotingContract, createPoseidonSMTContract } from '@/helpers'
import { DEFAULT_MASK_HEX, MAX_UINT_32_HEX, PRIME } from '@/pages/app/pages/polls/constants'
import { DecodedWhitelistData } from '@/pages/app/pages/polls/types'
import { NoirEIDIdentity } from '@/store/modules/identity/Identity'
import { ProposalState } from '@/types/contracts'
import { SparseMerkleTree } from '@/types/contracts/PoseidonSMT'

import { QueryProofParams } from './types/QueryIdentity'

/**
 * Builds and proves the Query Identity circuit.
 */
export class EIDBasedQueryIdentityCircuit {
  public circuitParams: NoirCircuitParams
  public currentIdentity: NoirEIDIdentity
  public proposalContract: ProposalState

  private _passportRegistrationProof?: SparseMerkleTree.ProofStructOutput

  constructor(identity: NoirEIDIdentity, proposalContract: ProposalState) {
    this.currentIdentity = identity
    this.circuitParams = NoirCircuitParams.fromName('queryIdentity_inid_ca')
    this.proposalContract = proposalContract
  }

  public static get rmoProvider() {
    return new JsonRpcProvider(RARIMO_CHAINS[Config.RMO_CHAIN_ID].rpcEvm)
  }

  public static get noirIdVotingContract() {
    return createNoirIdVotingContract(
      Config.NOIR_ID_VOTING_CONTRACT,
      EIDBasedQueryIdentityCircuit.rmoProvider,
    )
  }

  public static get registrationPoseidonSMTContract() {
    return createPoseidonSMTContract(
      Config.REGISTRATION_POSEIDON_SMT_CONTRACT_ADDRESS,
      EIDBasedQueryIdentityCircuit.rmoProvider,
    )
  }

  /**
   * Generates a ZK proof given serialized inputs.
   */
  async prove(params: Partial<QueryProofParams>) {
    const [byteCode, setupUri] = await Promise.all([
      this.circuitParams.downloadByteCode(),
      NoirCircuitParams.getTrustedSetupUri(),
    ])
    if (!setupUri) {
      throw new Error('Trusted setup URI missing')
    }

    const currentIdentity = this.currentIdentity

    if (!(currentIdentity instanceof NoirEIDIdentity))
      throw new Error('Identity is not NoirEIDIdentity')

    const rawTbsCertBytes = new Uint8Array(
      AsnConvert.serialize(currentIdentity.document.sigCertificate.certificate.tbsCertificate),
    )

    const passportProofIndexHex = await currentIdentity.getPassportProofIndex(
      currentIdentity.identityKey, // passport hash  (passportKey)
      currentIdentity.pkIdentityHash, // registrationProof.pub_signals[3] (IdentityKey)
    )

    const passportRegistrationProof =
      await currentIdentity.getPassportRegistrationProof(passportProofIndexHex)

    this._passportRegistrationProof = passportRegistrationProof

    const dg1 = Array.from(this.getDg1(rawTbsCertBytes)).map(String)

    const inputs = this._buildQueryProofParams({
      idStateRoot: passportRegistrationProof.root,
      dg1,
      pkPassportHash: `0x${currentIdentity.passportHash}`,
      siblings: passportRegistrationProof.siblings,
      ...params,
    })

    const proof = await this.circuitParams.prove(JSON.stringify(inputs), byteCode)

    if (!proof) {
      throw new Error(`Proof generation failed for circuit ${this.circuitParams.name}`)
    }
    return proof
  }

  async submitVote({
    proof,
    votes,
    proposalId,
  }: {
    proof: NoirZKProof
    votes: number[]
    proposalId: string
  }) {
    const abiCode = new AbiCoder()
    const userDataEncoded = abiCode.encode(
      ['uint256', 'uint256[]', 'tuple(uint256,uint256,uint256)'],
      [
        proposalId,
        // votes mask
        votes.map(v => 1 << Number(v)),
        // User payload: (nullifier, citizenship, timestampUpperbound)
        ['0x' + proof.pub_signals[0], '0x' + proof.pub_signals[6], '0x' + proof.pub_signals[15]],
      ],
    )

    if (!this._passportRegistrationProof)
      throw new Error("Passport registration proof doesn't exist")

    const callDataHex =
      EIDBasedQueryIdentityCircuit.noirIdVotingContract.contractInterface.encodeFunctionData(
        'executeNoir',
        [
          this._passportRegistrationProof.root as string,
          '0x' + proof.pub_signals[13],
          userDataEncoded,
          '0x' + proof.proof,
        ],
      )

    await relayerVote(callDataHex, Config.NOIR_ID_VOTING_CONTRACT)
  }

  async getEventId(proposalId: string) {
    return await this.proposalContract.getProposalEventId(proposalId)
  }

  async getPassportInfo() {
    const [passportInfo_, identityInfo_] = await this.currentIdentity.getPassportInfo()
    const identityReissueCounter = passportInfo_.identityReissueCounter
    const issueTimestamp = identityInfo_.issueTimestamp
    return { identityCounter: identityReissueCounter, timestamp: issueTimestamp }
  }

  async getVotingBounds({
    whitelistData,
    timestamp,
    identityCounter,
  }: {
    whitelistData: DecodedWhitelistData
    timestamp: bigint
    identityCounter: bigint
  }) {
    const ROOT_VALIDITY = BigInt(
      await EIDBasedQueryIdentityCircuit.registrationPoseidonSMTContract.contractInstance.ROOT_VALIDITY(),
    )

    let timestampUpper = BigInt(whitelistData.identityCreationTimestampUpperBound) - ROOT_VALIDITY
    let identityCountUpper = BigInt(MAX_UINT_32_HEX)

    if (timestamp > 0n) {
      timestampUpper = timestamp
      identityCountUpper = BigInt(whitelistData.identityCounterUpperBound)

      if (identityCounter > identityCountUpper) {
        throw new Error('Identity registered more than allowed, after voting start')
      }
    }

    return { timestampUpper, identityCountUpper }
  }

  getEventData(votes: number[]): string {
    // 2) ABI‑encode as an array of (uint256,uint256) structs
    const abiCoder = AbiCoder.defaultAbiCoder()
    const encoded = abiCoder.encode(['uint256[]'], [votes.map(v => 1 << v)])

    // 3) Take keccak256 hash
    const hashHex = keccak256(encoded)

    // 4) Cast to BigInt
    const hashBn = toBigInt(hashHex)

    // 5) Mask down to 248 bits: (1<<248) - 1
    const mask = (BigInt(1) << BigInt(248)) - BigInt(1)
    const truncated = hashBn & mask

    // 6) Zero‑pad up to 32 bytes (uint256) and return hex
    return zeroPadValue(toBeHex(truncated), 32)
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

  /**
   * Constructs circuit inputs in the correct format for the current platform.
   */
  private _buildQueryProofParams(params: QueryProofParams = {}) {
    const useHex = Platform.OS === 'android'
    const toHex = (v: string) => this._ensureHexPrefix(BigInt(v).toString(16))
    const toDec = (v: string) => BigInt(v).toString(10)
    const fmt = (v: string | undefined, def: string) => (useHex ? toHex(v ?? def) : toDec(v ?? def))

    const formatArray = (arr: string[] = []) =>
      arr.map(item =>
        useHex ? this._ensureHexPrefix(BigInt(item).toString(16)) : BigInt(item).toString(10),
      )

    return {
      event_id: fmt(params.eventId, this._getRandomHex()),
      event_data: fmt(params.eventData, this._getRandomDecimal()),
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
      current_date: fmt(params.currentDate, '000000'),
      siblings: formatArray(params.siblings),
    }
  }

  private _ensureHexPrefix(val: string): string {
    return val.startsWith('0x') ? val : `0x${val}`
  }

  private _getRandomDecimal(bits = 250): string {
    const rand = this._randomBigInt(bits)
    return (rand % BigInt(PRIME)).toString(10)
  }

  private _getRandomHex(bits = 250): string {
    const rand = this._randomBigInt(bits)
    return this._ensureHexPrefix((rand % BigInt(PRIME)).toString(16))
  }

  private _randomBigInt(bits: number): bigint {
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
}
