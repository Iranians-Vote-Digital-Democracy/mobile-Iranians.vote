import { apiClient } from '@/api/client'

export const relayerVerification = async (
  callDataHex: string,
  destinationContractAddress: string,
) => {
  return apiClient.post<{
    id: string
    type: 'txs'
    tx_hash: string
  }>('/integrations/proof-verification-relayer/v2/vote', {
    data: {
      attributes: {
        tx_data: callDataHex,
        destination: destinationContractAddress,
      },
    },
  })
}
