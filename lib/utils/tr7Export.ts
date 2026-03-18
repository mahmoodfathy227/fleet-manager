/**
 * TR7 Incident Report Word Document Export
 * Uses docxtemplater to fill Word template with incident data
 */

// @ts-ignore - CommonJS module types
import Docxtemplater from 'docxtemplater'
// @ts-ignore - CommonJS module types
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'

export interface TR7FormData {
  incident_date?: string
  incident_time?: string
  school_name?: string
  passenger_names?: string
  passenger_ages?: string
  passenger_ethnicity?: string
  operator_name?: string
  vehicle_number?: string
  exit_location?: string
  distance_from_destination?: string
  prior_incidents?: string
  passenger_comments?: string
  distinguishing_features?: string
  clothing_description?: string
  school_uniform_details?: string
  tas_staff_name?: string
  tas_report_time?: string
  police_reference_number?: string
  form_completed_by?: string
  signature_name?: string
  signature_date?: string
}

/**
 * Fills the TR7 Word template with incident data
 * @param data - TR7 incident report data
 * @param outputPath - Optional output path (defaults to ./output/TR7_filled.docx)
 * @returns Buffer containing the filled .docx file
 */
export async function fillTR7Report(
  data: TR7FormData,
  outputPath?: string
): Promise<Buffer> {
  try {
    // Load the template file
    const templatePath = path.join(process.cwd(), 'templates', 'TR7.docx')
    
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
      incident_date: data.incident_date || '',
      incident_time: data.incident_time || '',
      school_name: data.school_name || '',
      passenger_names: data.passenger_names || '',
      passenger_ages: data.passenger_ages || '',
      passenger_ethnicity: data.passenger_ethnicity || '',
      operator_name: data.operator_name || '',
      vehicle_number: data.vehicle_number || '',
      exit_location: data.exit_location || '',
      distance_from_destination: data.distance_from_destination || '',
      prior_incidents: data.prior_incidents || '',
      passenger_comments: data.passenger_comments || '',
      distinguishing_features: data.distinguishing_features || '',
      clothing_description: data.clothing_description || '',
      school_uniform_details: data.school_uniform_details || '',
      tas_staff_name: data.tas_staff_name || '',
      tas_report_time: data.tas_report_time || '',
      police_reference_number: data.police_reference_number || '',
      form_completed_by: data.form_completed_by || '',
      signature_name: data.signature_name || '',
      signature_date: data.signature_date || '',
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

      console.log('📋 Found placeholders in TR7 template:', Array.from(foundPlaceholders).join(', '))
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
        console.warn('⚠️  Missing placeholders in TR7 data:', missingPlaceholders.join(', '))
        console.warn('   These will be replaced with empty strings')
        missingPlaceholders.forEach(placeholder => {
          templateData[placeholder] = ''
        })
      }
    } catch (checkError) {
      console.warn('Could not check TR7 template placeholders:', checkError)
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
        throw new Error(`TR7 template rendering error:\n${errorMessages}`)
      }
      
      if (error.message) {
        console.error('Docxtemplater error:', error.message)
        throw new Error(`TR7 template rendering error: ${error.message}`)
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
      console.log(`✅ Filled TR7 document saved to: ${outputPath}`)
    }

    return buffer
  } catch (error: any) {
    console.error('Error in fillTR7Report:', error)
    throw new Error(`Failed to fill TR7 template: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Example TR7 data
 */
export const exampleTR7Data: TR7FormData = {
  incident_date: '2026-01-15',
  incident_time: '14:30',
  school_name: 'Lincoln Elementary School',
  passenger_names: 'Alice Brown, Charlie Wilson',
  passenger_ages: '8, 9',
  passenger_ethnicity: 'Caucasian, African American',
  operator_name: 'Fleet Management Inc',
  vehicle_number: 'VH-001',
  exit_location: 'Main Street bus stop',
  distance_from_destination: '2 blocks',
  prior_incidents: 'None reported',
  passenger_comments: 'Passengers were calm and cooperative',
  distinguishing_features: 'Alice: Red hair, glasses. Charlie: Tall for age, blue backpack',
  clothing_description: 'Alice: Blue jacket, jeans. Charlie: Green hoodie, khaki pants',
  school_uniform_details: 'Both wearing school uniform: Blue polo shirt, navy pants',
  tas_staff_name: 'Sarah Johnson',
  tas_report_time: '2026-01-15 15:00',
  police_reference_number: 'REF-2026-001234',
  form_completed_by: 'Sarah Johnson',
  signature_name: 'Sarah Johnson',
  signature_date: '2026-01-15',
}

