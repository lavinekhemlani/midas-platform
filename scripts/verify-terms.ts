import { db } from '../src/db'
import { learnTerms } from '../src/db/schema'
import fs from 'fs'
import path from 'path'

// List of files to check for term IDs
const FILES_TO_CHECK = [
  'src/app/(main)/reports/components/summary/SummaryKPIList.tsx',
  'src/app/(main)/reports/components/summary/FinancialHealthCard.tsx',
  'src/app/(main)/reports/components/pnl/PnLMetricsGrid.tsx',
  'src/app/(main)/reports/components/balance-sheet/BalanceSheetMetricsGrid.tsx',
  'src/app/(main)/reports/components/cash-flow/CashFlowMetricsGrid.tsx',
  'src/app/(main)/reports/types/financial-health.ts',
]

async function verifyTerms() {
  console.log('🔍 Verifying Learn Terms...\n')

  // 1. Extract terms from code
  const usedTerms = new Set<string>()
  const termLocations: Record<string, string[]> = {}

  for (const relativePath of FILES_TO_CHECK) {
    const fullPath = path.join(process.cwd(), relativePath)
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ File not found: ${relativePath}`)
      continue
    }

    const content = fs.readFileSync(fullPath, 'utf-8')

    // Regex to find termId="..." or termId: "..."
    // Matches: termId="foo-bar" OR termId: 'foo-bar' OR termId: "foo-bar"
    const regex = /termId[=:]\s*["']([^"']+)["']/g
    let match
    while ((match = regex.exec(content)) !== null) {
      const termId = match[1]
      usedTerms.add(termId)
      if (!termLocations[termId]) {
        termLocations[termId] = []
      }
      termLocations[termId].push(relativePath)
    }
  }

  console.log(`Found ${usedTerms.size} unique terms used in codebase:`)
  const sortedUsedTerms = Array.from(usedTerms).sort()
  sortedUsedTerms.forEach((term) => console.log(`  - ${term}`))

  // 2. Query DB
  console.log('\n📡 Querying Database for existing terms...')
  const dbTerms = await db.select().from(learnTerms)
  const dbTermIds = new Set(dbTerms.map((t) => t.termId))

  console.log(`Found ${dbTermIds.size} terms in database.`)

  // 3. Compare
  const missingInDb = sortedUsedTerms.filter((term) => !dbTermIds.has(term))
  const unusedInDb = Array.from(dbTermIds).filter((term) => !usedTerms.has(term))

  console.log('\n❌ MISSING IN DB (Need to be seeded):')
  if (missingInDb.length === 0) {
    console.log('  None! All used terms are present in DB.')
  } else {
    missingInDb.forEach((term) => {
      console.log(
        `  - ${term} (used in: ${termLocations[term].map((p) => path.basename(p)).join(', ')})`
      )
    })
  }

  console.log('\n⚠️  IN DB BUT NOT USED IN CHECKED FILES (Might be used elsewhere or legacy):')
  if (unusedInDb.length === 0) {
    console.log('  None.')
  } else {
    unusedInDb.sort().forEach((term) => console.log(`  - ${term}`))
  }

  process.exit(0)
}

verifyTerms().catch(console.error)
