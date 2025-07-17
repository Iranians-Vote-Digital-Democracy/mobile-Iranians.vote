import { Text, View } from 'react-native'

import { AppStackScreenProps } from '@/route-types'

export default function QueryProofSCreen(props: AppStackScreenProps<'QueryProof'>) {
  console.log(props)

  return (
    <View>
      <Text className='text-textPrimary'>Query Proof Screen</Text>
    </View>
  )
}
