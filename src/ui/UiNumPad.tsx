import type { ReactNode } from 'react'
import { useCallback, useMemo } from 'react'
import { Text, TouchableOpacity, View, type ViewProps } from 'react-native'

import { cn } from '@/theme'

import UiIcon from './UiIcon'

type Props = {
  value: string
  setValue: (value: string) => void
  extra?: ReactNode
} & ViewProps

export default function UiNumPad({ value, setValue, className, extra, ...rest }: Props) {
  const numArray = useMemo(() => {
    return [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '<-'],
    ]
  }, [])

  const handlePress = useCallback(
    (num: string) => {
      if (num === '<-') {
        setValue(value.slice(0, -1))
      } else {
        setValue(value + num)
      }
    },
    [setValue, value],
  )

  return (
    <View {...rest} className={cn('flex w-full gap-2', className)}>
      {numArray.map((row, i) => (
        <View key={i} className='flex flex-row justify-between gap-2'>
          {row.map((num, j) => {
            if (!num) {
              if (extra) {
                return (
                  <View
                    key={i + j}
                    className='h-full w-full flex-1 rounded-xl bg-backgroundContainer'
                  >
                    {extra}
                  </View>
                )
              }

              return <View key={i + j} className='flex flex-1 items-center justify-center' />
            }
            if (num === '<-') {
              return (
                <View
                  key={i + j}
                  className='h-full w-full flex-1 rounded-xl bg-backgroundContainer'
                >
                  <TouchableOpacity onPress={() => handlePress(num)}>
                    <View className='mt-1 flex-1 items-center justify-center'>
                      <UiIcon customIcon='backspaceIcon' size={32} className='color-textPrimary' />
                    </View>
                  </TouchableOpacity>
                </View>
              )
            }

            return (
              <View key={i + j} className='flex flex-1 rounded-xl bg-backgroundContainer'>
                <TouchableOpacity onPress={() => handlePress(num)}>
                  <Text className='typography-h4 text-center text-textPrimary'>{num}</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
