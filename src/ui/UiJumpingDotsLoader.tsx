import { useEffect, useRef } from 'react'
import { Animated, Easing, View } from 'react-native'

import { cn } from '@/theme'

const UiJumpingDotsLoader = ({ size = 10, color = 'textPrimary' }) => {
  const dot1Animation = useRef(new Animated.Value(0)).current
  const dot2Animation = useRef(new Animated.Value(0)).current
  const dot3Animation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const singleDotAnimation = animation =>
      Animated.sequence([
        Animated.timing(animation, {
          toValue: -10,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])

    const staggeredAnimation = Animated.loop(
      Animated.sequence([
        singleDotAnimation(dot1Animation),
        Animated.delay(150),
        singleDotAnimation(dot2Animation),
        Animated.delay(150),
        singleDotAnimation(dot3Animation),
        Animated.delay(150),
      ]),
    )

    staggeredAnimation.start()

    return () => staggeredAnimation.stop()
  }, [dot1Animation, dot2Animation, dot3Animation])

  return (
    <View className='flex-row items-center justify-center gap-2'>
      <Animated.View
        className={cn('rounded-full', `bg-${color}`)}
        style={{
          width: size,
          height: size,
          transform: [{ translateY: dot1Animation }],
        }}
      />
      <Animated.View
        className={cn('rounded-full', `bg-${color}`)}
        style={{
          width: size,
          height: size,
          transform: [{ translateY: dot2Animation }],
        }}
      />
      <Animated.View
        className={cn('rounded-full', `bg-${color}`)}
        style={{
          width: size,
          height: size,
          transform: [{ translateY: dot3Animation }],
        }}
      />
    </View>
  )
}

export default UiJumpingDotsLoader
