import type { RouteProp } from '@react-navigation/native'
import { useRoute } from '@react-navigation/native'

import {
  ScanContextProvider,
  Steps,
  useDocumentScanContext,
} from '@/pages/app/pages/document-scan/ScanProvider'
import type { AppStackParamsList } from '@/route-types'

import {
  DocumentPreviewStep,
  GenerateProofStep,
  RevocationStep,
  ScanMrzStep,
  ScanNfcStep,
  SelectDocTypeStep,
} from './components'

type ScanRouteProp = RouteProp<AppStackParamsList, 'Scan'>

export default function DocumentScanScreen() {
  const route = useRoute<ScanRouteProp>()
  const docType = route.params?.docType

  return (
    <ScanContextProvider docType={docType}>
      <DocumentScanContent />
    </ScanContextProvider>
  )
}

function DocumentScanContent() {
  const { currentStep, docType: _docType } = useDocumentScanContext()

  return (
    <>
      {{
        [Steps.SelectDocTypeStep]: () => <SelectDocTypeStep />,
        [Steps.ScanMrzStep]: () => <ScanMrzStep />,
        [Steps.ScanNfcStep]: () => <ScanNfcStep />,
        [Steps.DocumentPreviewStep]: () => <DocumentPreviewStep />,
        [Steps.GenerateProofStep]: () => <GenerateProofStep />,
        [Steps.RevocationStep]: () => <RevocationStep />,
      }[currentStep]?.() ?? <ScanNfcStep />}
    </>
  )
}
