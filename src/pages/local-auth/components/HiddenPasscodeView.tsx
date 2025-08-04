import type { ViewProps } from 'react-native'
import { View } from 'react-native'

import { cn } from '@/theme/utils'

type Props = {
  length: number
  maxLenght: number
} & ViewProps

export default function HiddenPasscodeView({ length, maxLenght }: Props) {
  return (
    <View className='flex h-[16] flex-row items-center gap-4'>
      {Array.from({ length: maxLenght }).map((_, i) => (
        <View
          key={i}
          className={cn(
            'size-[16] rounded-full',
            i < length ? 'bg-primaryMain' : 'bg-textSecondary',
          )}
        />
      ))}
    </View>
  )
}
