import { JournalInsightsView } from './views/JournalInsightsView'

export const metadata = {
  title: 'Journal | Zenith',
  description: 'General ledger journal entries with debit/credit analysis and transaction insights',
}

export default function JournalReportPage() {
  return (
    <div className="@container space-y-4 max-w-[1800px] mx-auto">
      <JournalInsightsView />
    </div>
  )
}
