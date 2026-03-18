/**
 * Example usage of TR7 export functionality
 */

import { fillTR7Report, TR7FormData, exampleTR7Data } from './tr7Export'
import path from 'path'

/**
 * Example: Generate TR7 report with sample data
 */
async function exampleUsage() {
  try {
    const buffer = await fillTR7Report(
      exampleTR7Data,
      path.join(process.cwd(), 'output', 'TR7_filled.docx')
    )

    console.log('✅ TR7 report generated successfully!')
    console.log(`📄 File size: ${buffer.byteLength} bytes`)
    return buffer
  } catch (error: any) {
    console.error('❌ Error generating TR7 report:', error.message)
    throw error
  }
}

export { exampleUsage }

