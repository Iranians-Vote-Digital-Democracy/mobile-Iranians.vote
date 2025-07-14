import type { LinearGradientProps } from 'react-native-linear-gradient'

type Gradient = 'aditionalGreenGradient' | 'aditionalPerpleGradient' | 'aditionalDarkGradient'

export const appGradients: Record<Gradient, LinearGradientProps> = {
  aditionalGreenGradient: {
    colors: ['#1D7F68', '#136854'],
    useAngle: false,
  },
  aditionalPerpleGradient: {
    colors: ['#E7C1FE', '#D3A6EE'],
    useAngle: false,
  },
  aditionalDarkGradient: {
    colors: ['#1D1D1D', '#1A1A1A'],
    useAngle: false,
  },
}
