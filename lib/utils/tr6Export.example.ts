/**
 * Example usage of TR6 export functionality
 */

import { fillTR6Report, TR6FormData, exampleTR6Data } from './tr6Export'
import path from 'path'

/**
 * Example: Generate TR6 report with sample data
 */
async function exampleUsage() {
  try {
    const buffer = await fillTR6Report(
      exampleTR6Data,
      path.join(process.cwd(), 'output', 'TR6_filled.docx')
    )

    console.log('✅ TR6 report generated successfully!')
    console.log(`📄 File size: ${buffer.byteLength} bytes`)
    return buffer
  } catch (error: any) {
    console.error('❌ Error generating TR6 report:', error.message)
    throw error
  }
}

export { exampleUsage }

