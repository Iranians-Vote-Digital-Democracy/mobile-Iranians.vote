import {
  ScanContextProvider,
  Steps,
  useDocumentScanContext,
} from '@/pages/app/pages/document-scan/ScanProvider'
import type { AppStackScreenProps } from '@/route-types'
import { DocType } from '@/utils/e-document'

import {
  DocumentPreviewStep,
  GenerateProofStep,
  RevocationStep,
  ScanNfcStep,
  SuccessStep,
} from './components'

export default function DocumentScanScreen({ route }: AppStackScreenProps<'Scan'>) {
  return (
    <ScanContextProvider docType={DocType.ID}>
      <DocumentScanContent />
    </ScanContextProvider>
  )
}

function DocumentScanContent() {
  const { currentStep } = useDocumentScanContext()

  return (
    <>
      {{
        // [Steps.SelectDocTypeStep]: () => <SelectDocTypeStep />,
        // [Steps.ScanMrzStep]: () => <ScanMrzStep />,
        [Steps.ScanNfcStep]: () => <ScanNfcStep />,
        [Steps.DocumentPreviewStep]: () => <DocumentPreviewStep />,
        [Steps.GenerateProofStep]: () => <GenerateProofStep />,
        [Steps.RevocationStep]: () => <RevocationStep />, //TODO
        [Steps.FinishStep]: () => <SuccessStep />, //TODO  meybe delete because in generate proof we have similar display
      }[currentStep]()}
    </>
  )
}
