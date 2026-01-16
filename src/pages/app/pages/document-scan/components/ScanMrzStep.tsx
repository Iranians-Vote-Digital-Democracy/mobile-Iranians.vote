import { useAppState } from '@react-native-community/hooks'
import { useIsFocused } from '@react-navigation/native'
import { parse } from 'mrz'
import { useCallback, useEffect, useMemo } from 'react'
import { ScrollView, Text, View } from 'react-native'
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera'
import { useTextRecognition } from 'react-native-vision-camera-text-recognition'
import { Worklets } from 'react-native-worklets-core'

import { bus, DefaultBusEvents, ErrorHandler } from '@/core'
import { useDocumentScanContext } from '@/pages/app/pages/document-scan/ScanProvider'
import { UiButton } from '@/ui'
import { DocType } from '@/utils/e-document'

const useMrzParser = (docType: DocType) => {
  const idCardParser = useCallback((lines: string[]) => {
    const numlinesToCheck = 3

    const possibleMRZLines = lines?.slice(-numlinesToCheck)

    if (!possibleMRZLines?.length || possibleMRZLines.length !== numlinesToCheck) return

    // const tdLength = possibleMRZLines[1].length
    const tdLength = 30

    const sanitizedMRZLines = possibleMRZLines.map(el => {
      return el.replaceAll('«', '<<').replaceAll(' ', '').toUpperCase()
    })

    sanitizedMRZLines[2] = sanitizedMRZLines[2].padEnd(tdLength, '<').toUpperCase()

    return parse(sanitizedMRZLines, {
      autocorrect: true,
    })
  }, [])

  const passportParser = useCallback((lines: string[]) => {
    const tdLength = 44

    // Sanitize all lines first
    const sanitizedLines = lines.map(el =>
      el.replaceAll('«', '<<').replaceAll(' ', '').toUpperCase(),
    )

    // Find MRZ line 1: starts with P (passport) and contains << (name separator)
    // Pattern: P<COUNTRYNAME<<FIRSTNAME<<...
    const mrzLine1Index = sanitizedLines.findIndex(
      line => /^P[A-Z<]/.test(line) && line.includes('<<') && line.length >= 30,
    )

    if (mrzLine1Index === -1) return undefined

    // MRZ line 2 should be right after line 1
    // Pattern: document number, nationality, DOB, sex, expiry, etc.
    // Contains mostly alphanumeric with < as filler
    const mrzLine2Index = mrzLine1Index + 1
    if (mrzLine2Index >= sanitizedLines.length) return undefined

    let line1 = sanitizedLines[mrzLine1Index]
    let line2 = sanitizedLines[mrzLine2Index]

    // Skip if line 2 is too short
    if (line2.length < 28) return undefined

    // Pad and trim to TD3 length (44 chars)
    line1 = line1.padEnd(tdLength, '<').substring(0, tdLength)
    line2 = line2.padEnd(tdLength, '<').substring(0, tdLength)

    console.warn('[MRZ] Trying to parse:', { line1, line2 })

    return parse([line1, line2], {
      autocorrect: true,
    })
  }, [])

  return {
    [DocType.ID]: idCardParser,
    [DocType.PASSPORT]: passportParser,
  }[docType]
}

export default function ScanMrzStep() {
  const { docType, setTempMrz } = useDocumentScanContext()

  const isFocused = useIsFocused()
  const currentAppState = useAppState()

  const device = useCameraDevice('back')
  const { hasPermission, requestPermission } = useCameraPermission()

  const { scanText } = useTextRecognition({
    language: 'latin',
  })

  const mrzParser = useMrzParser(docType ?? DocType.PASSPORT)

  const onMRZDetected = Worklets.createRunOnJS((lines: string[]) => {
    try {
      const result = mrzParser(lines)

      if (!result) return

      const fields = result.fields
      const hasEssentialFields =
        fields?.documentNumber &&
        fields?.birthDate &&
        fields?.expirationDate &&
        fields.documentNumber.length >= 8

      console.warn('[MRZ] Parse result:', {
        valid: result.valid,
        documentNumber: fields?.documentNumber,
        birthDate: fields?.birthDate,
        expirationDate: fields?.expirationDate,
        hasEssentialFields,
      })

      // Accept MRZ if either valid OR has essential fields for NFC reading
      // NFC chip will validate the actual data
      if (result.valid || hasEssentialFields) {
        bus.emit(DefaultBusEvents.success, {
          message: 'MRZ Detected',
        })
        setTempMrz(fields)
      }
    } catch (error) {
      // Log parse errors for debugging
      if (error instanceof Error && !error.message.includes('invalid number of characters')) {
        console.warn('[MRZ] Parse error:', error.message)
      }
    }
  })

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet'

      // FIXME: https://github.com/mrousavy/react-native-vision-camera/issues/2820
      runAtTargetFps(2, () => {
        'worklet'

        const data = scanText(frame)

        try {
          let resultText: string = ''

          if (data) {
            if (data?.length) {
              resultText = data.map(el => el.resultText).join('\n')
            } else if ('resultText' in data) {
              resultText = data.resultText as string
            } else {
              resultText = ''
            }

            if (resultText) {
              onMRZDetected(resultText.split('\n'))
            }
          }
        } catch (error) {
          ErrorHandler.processWithoutFeedback(error)
        }
      })
    },
    [scanText, onMRZDetected],
  )

  const isActive = useMemo(() => {
    return isFocused && currentAppState === 'active'
  }, [currentAppState, isFocused])

  useEffect(() => {
    if (hasPermission) return

    requestPermission()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View className='flex flex-1 flex-col'>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {isActive && (
          <>
            {hasPermission ? (
              <>
                {device && (
                  <Camera
                    style={{
                      marginTop: 50,
                      width: '100%',
                      height: '50%',
                    }}
                    device={device}
                    isActive={isActive}
                    enableFpsGraph={true}
                    frameProcessor={frameProcessor}
                  />
                )}
              </>
            ) : (
              <View>
                <Text className='typography-h4 text-textPrimary'>Requesting Camera Permission</Text>

                <UiButton onPress={requestPermission} title='Request Permission' />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
