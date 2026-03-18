/**
 * TR5 Incident Report Word Document Export
 * Uses docxtemplater to fill Word template with incident data
 */

// @ts-ignore - CommonJS module types
import Docxtemplater from 'docxtemplater'
// @ts-ignore - CommonJS module types
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'

export interface TR5FormData {
  incident_date: string
  incident_time: string
  form_completed_date: string
  fps_number: string
  operator_name: string
  establishment_name: string
  driver_name: string
  driver_tas_number: string
  vehicle_registration: string
  pa_names: string
  pa_tas_numbers: string
  passengers_involved: string
  incident_triggers?: string
  previous_incidents?: string
  prevention_actions?: string
  actions_during_incident?: string
  incident_outcome?: string
  reported_to?: string
  who_was_informed?: string
  staff_suggestions?: string
  photos_attached: string
  report_completed_by: string
  reporter_signature?: string
  reporter_signature_date?: string
  witnessed_incident?: string
  witness_signature_1?: string
  witness_signature_2?: string
  witness_signature_date?: string
  description: string
}

/**
 * Fills the TR5 Word template with incident data
 * @param data - Incident report data
 * @param outputPath - Optional output path (defaults to ./output/TR5_filled.docx)
 * @returns Buffer containing the filled .docx file
 */
export async function fillIncidentReport(
  data: TR5FormData,
  outputPath?: string
): Promise<Buffer> {
  try {
    // Load the template file
    const templatePath = path.join(process.cwd(), 'templates', 'TR5.docx')
    
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
      form_completed_date: data.form_completed_date || '',
      fps_number: data.fps_number || '',
      operator_name: data.operator_name || '',
      establishment_name: data.establishment_name || '',
      driver_name: data.driver_name || '',
      driver_tas_number: data.driver_tas_number || '',
      vehicle_registration: data.vehicle_registration || '',
      pa_names: data.pa_names || '',
      pa_tas_numbers: data.pa_tas_numbers || '',
      passengers_involved: data.passengers_involved || '',
      incident_triggers: data.incident_triggers || '',
      previous_incidents: data.previous_incidents || '',
      prevention_actions: data.prevention_actions || '',
      actions_during_incident: data.actions_during_incident || '',
      incident_outcome: data.incident_outcome || '',
      reported_to: data.reported_to || '',
      who_was_informed: data.who_was_informed || '',
      staff_suggestions: data.staff_suggestions || '',
      photos_attached: data.photos_attached || 'No',
      report_completed_by: data.report_completed_by || '',
      reporter_signature: data.reporter_signature || '',
      reporter_signature_date: data.reporter_signature_date || '',
      witnessed_incident: data.witnessed_incident || '',
      witness_signature_1: data.witness_signature_1 || '',
      witness_signature_2: data.witness_signature_2 || '',
      witness_signature_date: data.witness_signature_date || '',
      description: data.description || '',
    }

    // Check for placeholders in template and validate
    try {
      const templateText = zip.files['word/document.xml'].asText()
      const placeholderPattern = /\{\{([^}]+)\}\}/g
      const foundPlaceholders = new Set<string>()
      let match
      
      while ((match = placeholderPattern.exec(templateText)) !== null) {
        // Extract placeholder name (handle nested properties like {{user.name}})
        const placeholder = match[1].trim()
        foundPlaceholders.add(placeholder)
      }

      console.log('📋 Found placeholders in template:', Array.from(foundPlaceholders).join(', '))
      console.log('📋 Available data keys:', Object.keys(templateData).join(', '))

      // Log missing placeholders
      const missingPlaceholders: string[] = []
      foundPlaceholders.forEach(placeholder => {
        // Check if placeholder exists in data (handle simple placeholders only)
        if (!placeholder.includes('.') && !placeholder.includes('[')) {
          if (!(placeholder in templateData) || templateData[placeholder] === undefined) {
            missingPlaceholders.push(placeholder)
          }
        }
      })

      if (missingPlaceholders.length > 0) {
        console.warn('⚠️  Missing placeholders in data:', missingPlaceholders.join(', '))
        console.warn('   These will be replaced with empty strings')
        // Add empty strings for missing placeholders to avoid errors
        missingPlaceholders.forEach(placeholder => {
          templateData[placeholder] = ''
        })
      }
    } catch (checkError) {
      console.warn('Could not check template placeholders:', checkError)
      // Continue anyway - docxtemplater will handle errors
    }

    // Set the template data
    doc.setData(templateData)

    // Render the document
    try {
      doc.render()
    } catch (error: any) {
      // Handle rendering errors - docxtemplater provides detailed error information
      console.error('Docxtemplater render error:', error)
      console.error('Error properties:', error.properties)
      
      // Handle MultiError specifically
      if (error.name === 'MultiError' || (error.properties && error.properties.errors)) {
        const errors = error.properties?.errors || error.errors || []
        if (Array.isArray(errors) && errors.length > 0) {
          // Check if errors are related to duplicate XML tags
          const hasDuplicateTagErrors = errors.some((e: any) => 
            e.message?.includes('Duplicate') || e.message?.includes('duplicate')
          )
          
          if (hasDuplicateTagErrors) {
            throw new Error(
              `The Word template has duplicate XML tags (corrupted XML). ` +
              `Please fix the template by:\n` +
              `1. Open templates/TR5.docx in Microsoft Word\n` +
              `2. Go to File > Save As\n` +
              `3. Save it as a new file (this will clean the XML)\n` +
              `4. Replace the old template with the newly saved file\n\n` +
              `Original errors: ${errors.map((e: any) => e.message).join('; ')}`
            )
          }
          
          const errorMessages = errors
            .map((e: any, index: number) => {
              const explanation = e.explanation ? ` - ${e.explanation}` : ''
              const properties = e.properties ? ` (at ${JSON.stringify(e.properties)})` : ''
              return `Error ${index + 1}: ${e.name || 'Unknown'}: ${e.message || 'Unknown error'}${explanation}${properties}`
            })
            .join('\n')
          
          console.error('Detailed docxtemplater errors:', JSON.stringify(errors, null, 2))
          throw new Error(`Template rendering error (${errors.length} error(s)):\n${errorMessages}`)
        }
      }
      
      // Handle other error types
      if (error.message) {
        console.error('Docxtemplater error message:', error.message)
        throw new Error(`Template rendering error: ${error.message}`)
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
      console.log(`✅ TR5 form saved to: ${outputPath}`)
    } else {
      // Default output path
      const defaultOutputDir = path.join(process.cwd(), 'output')
      if (!fs.existsSync(defaultOutputDir)) {
        fs.mkdirSync(defaultOutputDir, { recursive: true })
      }
      const defaultOutputPath = path.join(defaultOutputDir, 'TR5_filled.docx')
      fs.writeFileSync(defaultOutputPath, buffer)
      console.log(`✅ TR5 form saved to: ${defaultOutputPath}`)
    }

    return buffer
  } catch (error: any) {
    console.error('❌ Error filling TR5 incident report:', error)
    console.error('Error stack:', error.stack)
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error'
    
    // Handle MultiError from docxtemplater
    if (error.name === 'MultiError' || error.message?.includes('Multi error')) {
      const errors = error.errors || error.properties?.errors || []
      if (Array.isArray(errors) && errors.length > 0) {
        errorMessage = errors.map((e: any) => {
          return `${e.name || 'Error'}: ${e.message || 'Unknown error'}${e.explanation ? ` (${e.explanation})` : ''}`
        }).join('; ')
      }
    } else if (error.properties && error.properties.errors) {
      const errors = error.properties.errors
      if (Array.isArray(errors) && errors.length > 0) {
        errorMessage = errors.map((e: any) => {
          return `${e.name || 'Error'}: ${e.message || 'Unknown error'}${e.explanation ? ` (${e.explanation})` : ''}`
        }).join('; ')
      }
    }
    
    throw new Error(`Failed to fill TR5 template: ${errorMessage}`)
  }
}

/**
 * Example data object for testing
 */
export const exampleTR5Data: TR5FormData = {
  incident_date: '15/01/2025',
  incident_time: '08:30',
  form_completed_date: '15/01/2025',
  fps_number: 'FPS-123',
  operator_name: 'Fleet Transport Services',
  establishment_name: 'Sandwell School',
  driver_name: 'John Smith',
  driver_tas_number: 'TAS-001',
  vehicle_registration: 'AB12 CDE',
  pa_names: 'Jane Doe',
  pa_tas_numbers: 'TAS-002',
  passengers_involved: 'Alice Johnson, Bob Williams',
  incident_triggers: 'Passenger became agitated during journey',
  previous_incidents: 'No previous incidents',
  prevention_actions: 'Attempted to calm passenger, redirected attention',
  actions_during_incident: 'Stopped vehicle safely, contacted supervisor',
  incident_outcome: 'Passenger calmed down, journey continued',
  reported_to: 'Supervisor and school',
  who_was_informed: 'School contacted, parent notified',
  staff_suggestions: 'Consider additional support for this passenger',
  photos_attached: 'Yes',
  report_completed_by: 'John Smith',
  reporter_signature: 'John Smith',
  reporter_signature_date: '15/01/2025',
  witnessed_incident: 'Yes',
  witness_signature_1: 'Jane Doe',
  witness_signature_2: '',
  witness_signature_date: '15/01/2025',
  description: 'During the morning route, passenger Alice Johnson became agitated and started shouting. The driver safely stopped the vehicle and the PA attempted to calm the situation. After 5 minutes, the passenger calmed down and the journey continued without further incident.',
}

