import type { ChainInfo } from './types'

enum RarimoChains {
  Mainnet = '7368',
  Testnet = '7369',
}

export const RARIMO_CHAINS: Record<string, ChainInfo> = {
  [RarimoChains.Testnet]: {
    chainId: '7369',
    chainName: 'Rarimo L2 Testnet',
    chainSymbolImageUrl:
      'https://raw.githubusercontent.com/rarimo/js-sdk/2.0.0-rc.14/assets/logos/ra-dark-logo.png',
    rpcEvm: 'https://l2.testnet.rarimo.com',
    explorerUrl: 'https://scan.testnet.rarimo.com',
  },
  [RarimoChains.Mainnet]: {
    chainId: '7368',
    chainName: 'Rarimo Mainnet',
    chainSymbolImageUrl:
      'https://raw.githubusercontent.com/rarimo/js-sdk/2.0.0-rc.14/assets/logos/ra-dark-logo.png',

    rpcEvm: 'https://l2.rarimo.com',
    explorerUrl: 'https://scan.rarimo.com',
  },
}
