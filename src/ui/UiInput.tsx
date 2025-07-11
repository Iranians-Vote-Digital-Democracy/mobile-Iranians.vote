import * as React from 'react'
import { forwardRef } from 'react'
import { FieldValues, useController, UseControllerProps } from 'react-hook-form'
import { Text, TextInput, type TextInputProps, View } from 'react-native'

import { cn } from '@/theme/utils'

type Props = TextInputProps & { ref?: React.RefObject<TextInput> }

const UiInput = forwardRef<TextInput, Props>(
  ({ className, placeholderClassName, ...props }, ref) => {
    return (
      <TextInput
        className={cn(
          'native:h-12 native:text-lg native:leading-[1.25] web:ring-offset-background web:focus-visible:ring-ring h-10 rounded-md border border-textPrimary bg-backgroundPrimary px-3 text-base text-textPrimary file:border-0 file:bg-transparent file:font-medium placeholder:text-textPrimary web:flex web:w-full web:py-2 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-offset-2 lg:text-sm',
          props.editable === false && 'opacity-50 web:cursor-not-allowed',
          className,
        )}
        placeholderClassName={cn('text-muted-foreground text-textPrimary', placeholderClassName)}
        {...props}
        ref={ref}
      />
    )
  },
)

export type ControlledInputProps<T extends FieldValues> = Props & UseControllerProps<T>

export function ControlledUiInput<T extends FieldValues>({
  name,
  control,
  rules,
  onChangeText,
  ...rest
}: ControlledInputProps<T>) {
  const { field, fieldState } = useController({ control, name, rules: rules })

  return (
    <View className='flex w-full gap-3'>
      <UiInput
        className='w-full'
        ref={field.ref}
        autoCapitalize='none'
        onChangeText={v => {
          onChangeText?.(v)
          field.onChange(v)
        }}
        multiline={true}
        value={(field.value as string) || ''}
        {...rest}
      />
      {fieldState.error?.message && (
        <Text className='w-full text-errorMain typography-body2'>{fieldState.error?.message}</Text>
      )}
    </View>
  )
}

export { UiInput }
