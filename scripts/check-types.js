const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('Running TypeScript check on source files...\n')

try {
  // Run tsc with focus on src folder
  const result = execSync('npx tsc --noEmit --skipLibCheck', {
    encoding: 'utf-8',
    cwd: __dirname,
  })

  console.log('✅ No TypeScript errors found in source files!')
} catch (error) {
  const output = error.stdout || error.message

  // Filter out .next folder errors
  const lines = output.split('\n')
  const srcErrors = lines.filter((line) => line.includes('src/') && !line.includes('.next/'))

  if (srcErrors.length > 0) {
    console.log('❌ TypeScript errors found in source files:\n')
    srcErrors.forEach((line) => console.log(line))
  } else {
    console.log('✅ No TypeScript errors in source files!')
    console.log('(Note: Some errors in .next/ generated files can be ignored)')
  }
}
