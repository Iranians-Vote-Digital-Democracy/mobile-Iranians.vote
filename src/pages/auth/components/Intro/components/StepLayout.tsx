import type { ReactElement } from 'react'
import type { ViewProps } from 'react-native'
import { Text, View } from 'react-native'

import { cn } from '@/theme'

type StepLayoutProps = ViewProps & {
  title: string
  subtitle: string
  media: ReactElement
}

export default function StepLayout({
  title,
  subtitle,
  media,
  className,
  ...rest
}: StepLayoutProps) {
  return (
    <View {...rest} className={cn('flex flex-col items-center justify-center', className)}>
      <View className={cn('flex-grow items-center justify-center')}>{media}</View>

      <View className={cn('flex flex-col items-center justify-center')}>
        <Text className={cn('text-center text-textPrimary typography-h4')}>{title}</Text>
        <Text className={cn('mt-5 text-center text-textSecondary typography-body2')}>
          {subtitle}
        </Text>
      </View>
    </View>
  )
}
