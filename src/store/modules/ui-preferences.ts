import { useCallback, useMemo } from 'react'
import type { ImageBackgroundProps } from 'react-native'
import { create } from 'zustand'
import { combine, createJSONStorage, persist } from 'zustand/middleware'

import { translate } from '@/core'
import { zustandStorage } from '@/store/helpers'
import { useAppTheme } from '@/theme'
import { PersonDetails } from '@/utils/e-document/e-document'

export type DocumentCardUiPreference = {
  key: number
  personalDetailsShown: Array<keyof PersonDetails>
  isBlurred: boolean
}

const useUiPreferencesStore = create(
  persist(
    combine(
      {
        documentsCardUi: {} as Record<string, DocumentCardUiPreference>,
      },
      set => ({
        updateDocumentsCardUi: (value: Record<string, DocumentCardUiPreference>) =>
          set(state => ({
            ...state,
            documentsCardUi: value,
          })),
        clearDocumentsCardUi: () => set({ documentsCardUi: {} }),
      }),
    ),
    {
      name: 'ui-preferences',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),

      partialize: state => ({
        documentsCardUi: state.documentsCardUi,
      }),
    },
  ),
)

const useDocumentCardUiPreference = (id: string) => {
  const { documentsCardUi, updateDocumentsCardUi } = useUiPreferencesStore(state => ({
    documentsCardUi: state.documentsCardUi,
    updateDocumentsCardUi: state.updateDocumentsCardUi,
  }))
  const { palette } = useAppTheme()

  const uiVariants = useMemo(() => {
    return [
      {
        key: 1,
        title: translate('ui-preferences.primary'),
        background: {
          style: {
            backgroundColor: palette.backgroundContainer,
          },
        },
        foregroundLabels: {
          style: {
            color: palette.textSecondary,
          },
        },
        foregroundValues: {
          style: {
            color: palette.textPrimary,
          },
        },
      },
      {
        key: 2,
        title: translate('ui-preferences.secondary'),
        background: {
          style: {
            backgroundColor: palette.primaryMain,
          },
        },
        foregroundLabels: {
          style: {
            color: 'rgba(255, 255, 255, 0.56)',
          },
        },
        foregroundValues: {
          style: {
            color: palette.baseWhite,
          },
        },
      },
      {
        key: 3,
        title: translate('ui-preferences.tertiary'),
        background: {
          source: {
            uri: 'https://docs.expo.dev/static/images/tutorial/background-image.png',
          },
          style: {
            borderRadius: 24,
            overflow: 'hidden',
          },
        } as ImageBackgroundProps,
        foregroundLabels: {
          style: {
            color: 'rgba(255, 255, 255, 0.75)',
          },
        },
        foregroundValues: {
          style: {
            color: palette.baseWhite,
          },
        },
      },
    ]
  }, [
    palette.backgroundContainer,
    palette.baseWhite,
    palette.primaryMain,
    palette.textPrimary,
    palette.textSecondary,
  ])

  const personalDetailsShownVariants = useMemo((): Array<keyof PersonDetails> => {
    return ['nationality', 'documentNumber', 'expiryDate']
  }, [])

  const savedSettings: DocumentCardUiPreference = useMemo(() => {
    const defaultSettings: DocumentCardUiPreference = {
      key: uiVariants[0].key,
      personalDetailsShown: ['nationality'],
      isBlurred: false,
    }
    return documentsCardUi[id] ?? defaultSettings
  }, [documentsCardUi, id, uiVariants])

  const documentCardUi = useMemo(() => {
    const selectedVariant =
      uiVariants.find(variant => variant.key === savedSettings.key) ?? uiVariants[0]

    return {
      ...selectedVariant,
      personalDetailsShown: savedSettings.personalDetailsShown,
      isBlurred: savedSettings.isBlurred,
    }
  }, [uiVariants, savedSettings])

  const setDocumentCardUi = useCallback(
    (value: DocumentCardUiPreference) => {
      const newSettings: DocumentCardUiPreference = {
        ...value,
        personalDetailsShown: value.personalDetailsShown ?? savedSettings.personalDetailsShown,
        isBlurred: value.isBlurred ?? savedSettings.isBlurred,
      }

      updateDocumentsCardUi({
        ...documentsCardUi,
        [id]: newSettings,
      })
    },
    [documentsCardUi, id, savedSettings, updateDocumentsCardUi],
  )

  const togglePersonalDetailsVisibility = useCallback(
    (key: keyof PersonDetails) => {
      const personalDetailsShown = documentCardUi.personalDetailsShown
      const newPersonalDetailsShown = personalDetailsShown.includes(key)
        ? personalDetailsShown.filter(item => item !== key)
        : [...personalDetailsShown, key]

      setDocumentCardUi({
        ...documentCardUi,
        personalDetailsShown: newPersonalDetailsShown,
      })
    },
    [documentCardUi, setDocumentCardUi],
  )

  const toggleIsBlurred = useCallback(() => {
    setDocumentCardUi({
      ...documentCardUi,
      isBlurred: !documentCardUi.isBlurred,
    })
  }, [documentCardUi, setDocumentCardUi])

  return {
    uiVariants,
    personalDetailsShownVariants,

    documentCardUi,
    setDocumentCardUi,

    togglePersonalDetailsVisibility,
    toggleIsBlurred,
  }
}

export const uiPreferencesStore = {
  useUiPreferencesStore,
  useDocumentCardUiPreference,
}
