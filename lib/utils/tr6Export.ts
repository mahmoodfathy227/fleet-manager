/**
 * TR6 Incident Report Word Document Export
 * Uses docxtemplater to fill Word template with incident data
 */

// @ts-ignore - CommonJS module types
import Docxtemplater from 'docxtemplater'
// @ts-ignore - CommonJS module types
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'

export interface TR6FormData {
  other_driver_name?: string
  is_registered_owner?: string
  vehicle_owner_name?: string
  insurance_company?: string
  insurance_policy_number?: string
  other_vehicle_make?: string
  other_vehicle_colour?: string
  other_vehicle_registration?: string
  damage_description?: string
  accident_location?: string
  accident_datetime?: string
  witness_names?: string
  witness_address?: string
  other_driver_comments?: string
}

/**
 * Fills the TR6 Word template with incident data
 * @param data - TR6 incident report data
 * @param outputPath - Optional output path (defaults to ./output/TR6_filled.docx)
 * @returns Buffer containing the filled .docx file
 */
export async function fillTR6Report(
  data: TR6FormData,
  outputPath?: string
): Promise<Buffer> {
  try {
    // Load the template file
    const templatePath = path.join(process.cwd(), 'templates', 'TR6.docx')
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at: ${templatePath}`)
    }

    // Read the template file
    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)
    
    // Note: If you get "Duplicate open/close tag" errors, the Word template has corrupted XML.
    // Fix it by opening the template in Word and saving it as a new file.
    
    // Create docxtemplater instance with nullGetter and error recovery
    const docOptions: any = {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '', // Return empty string for missing/null values
      delimiters: {
        start: '{{',
        end: '}}',
      },
    }
    
    const doc = new Docxtemplater(zip, docOptions)

    // Prepare data with defaults for missing fields
    const templateData: Record<string, string> = {
      other_driver_name: data.other_driver_name || '',
      is_registered_owner: data.is_registered_owner || '',
      vehicle_owner_name: data.vehicle_owner_name || '',
      insurance_company: data.insurance_company || '',
      insurance_policy_number: data.insurance_policy_number || '',
      other_vehicle_make: data.other_vehicle_make || '',
      other_vehicle_colour: data.other_vehicle_colour || '',
      other_vehicle_registration: data.other_vehicle_registration || '',
      damage_description: data.damage_description || '',
      accident_location: data.accident_location || '',
      accident_datetime: data.accident_datetime || '',
      witness_names: data.witness_names || '',
      witness_address: data.witness_address || '',
      other_driver_comments: data.other_driver_comments || '',
    }

    // Check for placeholders in template and validate
    try {
      const templateText = zip.files['word/document.xml'].asText()
      const placeholderPattern = /\{\{([^}]+)\}\}/g
      const foundPlaceholders = new Set<string>()
      let match
      
      while ((match = placeholderPattern.exec(templateText)) !== null) {
        const placeholder = match[1].trim()
        foundPlaceholders.add(placeholder)
      }

      console.log('📋 Found placeholders in TR6 template:', Array.from(foundPlaceholders).join(', '))
      console.log('📋 Available data keys:', Object.keys(templateData).join(', '))

      // Log missing placeholders
      const missingPlaceholders: string[] = []
      foundPlaceholders.forEach(placeholder => {
        if (!placeholder.includes('.') && !placeholder.includes('[')) {
          if (!(placeholder in templateData) || templateData[placeholder] === undefined) {
            missingPlaceholders.push(placeholder)
          }
        }
      })

      if (missingPlaceholders.length > 0) {
        console.warn('⚠️  Missing placeholders in TR6 data:', missingPlaceholders.join(', '))
        console.warn('   These will be replaced with empty strings')
        missingPlaceholders.forEach(placeholder => {
          templateData[placeholder] = ''
        })
      }
    } catch (checkError) {
      console.warn('Could not check TR6 template placeholders:', checkError)
    }

    // Set the template data
    doc.setData(templateData)

    // Render the document
    try {
      doc.render()
    } catch (error: any) {
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((e: any) => {
            const explanation = e.explanation ? ` (${e.explanation})` : ''
            const properties = e.properties ? ` at ${JSON.stringify(e.properties)}` : ''
            return `${e.name}: ${e.message}${explanation}${properties}`
          })
          .join('\n')
        
        console.error('Docxtemplater errors:', error.properties.errors)
        throw new Error(`TR6 template rendering error:\n${errorMessages}`)
      }
      
      if (error.message) {
        console.error('Docxtemplater error:', error.message)
        throw new Error(`TR6 template rendering error: ${error.message}`)
      }
      
      throw error
    }

    // Generate the document buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    // Save to output directory if path is provided
    if (outputPath) {
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      fs.writeFileSync(outputPath, buffer)
      console.log(`✅ Filled TR6 document saved to: ${outputPath}`)
    }

    return buffer
  } catch (error: any) {
    console.error('Error in fillTR6Report:', error)
    throw new Error(`Failed to fill TR6 template: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Example TR6 data
 */
export const exampleTR6Data: TR6FormData = {
  other_driver_name: 'John Smith',
  is_registered_owner: 'Yes',
  vehicle_owner_name: 'John Smith',
  insurance_company: 'ABC Insurance Ltd',
  insurance_policy_number: 'POL-123456',
  other_vehicle_make: 'Toyota',
  other_vehicle_colour: 'Blue',
  other_vehicle_registration: 'ABC-1234',
  damage_description: 'Front bumper damage, minor scratches on driver side door',
  accident_location: 'Main Street and First Avenue intersection',
  accident_datetime: '2026-01-15 14:30',
  witness_names: 'Jane Doe, Bob Johnson',
  witness_address: '123 Main St, City, State 12345',
  other_driver_comments: 'Driver appeared to be distracted, ran red light',
}

