/**
 * TR1 Excel Template Filler
 * Fills the Home to School Transport Record (TR1) template with data
 * while preserving all formatting, borders, and structure
 */

const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Get all weekdays (Monday-Friday) for a given month and year
 * @param {number} year - The year (e.g., 2024)
 * @param {number} month - The month (1-12)
 * @returns {number[]} - Array of day numbers that are weekdays
 */
function getWeekdaysInMonth(year, month) {
  const weekdays = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      weekdays.push(day);
    }
  }
  
  return weekdays;
}

/**
 * Get month name from month number
 * @param {number} month - Month number (1-12)
 * @returns {string} - Month name
 */
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

/**
 * Fill the TR1 template with data
 * @param {Object} options - Configuration options
 */
async function fillTR1Template(options) {
  const {
    // Input/Output files
    templatePath = './TR1.xlsx',
    outputPath = './TR1_filled.xlsx',
    
    // Header data
    year,
    month,
    schoolName,
    refNumber,
    operatorName,
    vehicleRegNo,
    licensingBadgeNo,
    psvDiscVehiclePlateNo,
    driverName,
    driverTasNo,
    passengerAssistantNames = [], // Array of PA names
    passengerAssistantTasNos = [], // Array of PA TAS numbers
    
    // Passenger data
    passengerNames = [],
    
    // Cell locations (adjust these based on your actual template)
    cellLocations = {
      // Header fields - UPDATE THESE TO MATCH YOUR TEMPLATE
      month: 'C2',
      school: 'C3',
      refNumber: 'C4',
      operator: 'C5',
      vehicleRegNo: 'C6',
      licensingBadgeNo: 'AC6',
      psvDiscVehiclePlateNo: 'AV6',
      driverName: 'C9',
      driverTasNo: 'C10',
      passengerAssistantName: 'C11', // First PA
      passengerAssistantTasNo: 'C12', // First PA TAS
      
      // Table structure
      dateRowNumber: 15, // Row where dates are written
      dateStartColumn: 2, // Column B (1=A, 2=B, 3=C, etc.)
      passengerNameColumn: 1, // Column A
      passengerStartRow: 16, // First row for passenger names
    },
    
    // Worksheet name
    worksheetName = 'Sheet1', // Update if your sheet has a different name
  } = options;

  try {
    // Load the template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    
    // Get the first worksheet (or by name if specified)
    const worksheet = workbook.getWorksheet(worksheetName) || workbook.getWorksheet(1);
    
    if (!worksheet) {
      throw new Error('Worksheet not found in template');
    }

    console.log(`📄 Loaded template: ${templatePath}`);
    console.log(`📋 Working with worksheet: ${worksheet.name}`);

    // =========================================
    // 1️⃣ FILL HEADER FIELDS
    // =========================================
    console.log('\n📝 Filling header fields...');
    
    // Month
    if (month) {
      const monthName = getMonthName(month);
      worksheet.getCell(cellLocations.month).value = monthName;
      console.log(`   ✓ Month: ${monthName}`);
    }
    
    // School
    if (schoolName) {
      worksheet.getCell(cellLocations.school).value = schoolName;
      console.log(`   ✓ School: ${schoolName}`);
    }
    
    // Ref Number
    if (refNumber) {
      worksheet.getCell(cellLocations.refNumber).value = refNumber;
      console.log(`   ✓ Ref Number: ${refNumber}`);
    }
    
    // Operator
    if (operatorName) {
      worksheet.getCell(cellLocations.operator).value = operatorName;
      console.log(`   ✓ Operator: ${operatorName}`);
    }
    
    // Vehicle Reg No
    if (vehicleRegNo) {
      worksheet.getCell(cellLocations.vehicleRegNo).value = vehicleRegNo;
      console.log(`   ✓ Vehicle Reg No: ${vehicleRegNo}`);
    }
    
    // Licensing Badge No
    // Always set the value (even if empty) to ensure the cell is filled/cleared
    worksheet.getCell(cellLocations.licensingBadgeNo).value = licensingBadgeNo || '';
    if (licensingBadgeNo) {
      console.log(`   ✓ Licensing Badge No: ${licensingBadgeNo}`);
    } else {
      console.log(`   ⚠ Licensing Badge No: (empty)`);
    }
    
    // PSV Disc / Vehicle Plate No
    // Always set the value (even if empty) to ensure the cell is filled/cleared
    worksheet.getCell(cellLocations.psvDiscVehiclePlateNo).value = psvDiscVehiclePlateNo || '';
    if (psvDiscVehiclePlateNo) {
      console.log(`   ✓ PSV Disc / Vehicle Plate No: ${psvDiscVehiclePlateNo}`);
    } else {
      console.log(`   ⚠ PSV Disc / Vehicle Plate No: (empty)`);
    }
    
    // Driver Name
    if (driverName) {
      worksheet.getCell(cellLocations.driverName).value = driverName;
      console.log(`   ✓ Driver Name: ${driverName}`);
    }
    
    // Driver TAS No
    if (driverTasNo) {
      worksheet.getCell(cellLocations.driverTasNo).value = driverTasNo;
      console.log(`   ✓ Driver TAS No: ${driverTasNo}`);
    }
    
    // Passenger Assistant Name(s)
    if (passengerAssistantNames.length > 0) {
      const paNames = passengerAssistantNames.join(', ');
      worksheet.getCell(cellLocations.passengerAssistantName).value = paNames;
      console.log(`   ✓ Passenger Assistant Name(s): ${paNames}`);
    }
    
    // Passenger Assistant TAS No(s)
    if (passengerAssistantTasNos.length > 0) {
      const paTasNos = passengerAssistantTasNos.join(', ');
      worksheet.getCell(cellLocations.passengerAssistantTasNo).value = paTasNos;
      console.log(`   ✓ Passenger Assistant TAS No(s): ${paTasNos}`);
    }

    // =========================================
    // 2️⃣ FILL TABLE DATES (Monday-Friday only)
    // =========================================
    if (year && month) {
      console.log('\n📅 Filling weekday dates...');
      const weekdays = getWeekdaysInMonth(year, month);
      console.log(`   Found ${weekdays.length} weekdays in ${getMonthName(month)} ${year}`);
      
      weekdays.forEach((dayNumber, index) => {
        const columnIndex = cellLocations.dateStartColumn + index;
        const cell = worksheet.getCell(cellLocations.dateRowNumber, columnIndex);
        
        // Write only the day number
        cell.value = dayNumber;
        
        // Preserve existing formatting (don't change alignment, font, etc.)
        console.log(`   ✓ Day ${dayNumber} → Column ${columnIndex}`);
      });
    }

    // =========================================
    // 3️⃣ FILL PASSENGER NAMES
    // =========================================
    if (passengerNames.length > 0) {
      console.log('\n👥 Filling passenger names...');
      
      passengerNames.forEach((passengerName, index) => {
        const rowIndex = cellLocations.passengerStartRow + index;
        const cell = worksheet.getCell(rowIndex, cellLocations.passengerNameColumn);
        
        // Write passenger name
        cell.value = passengerName;
        
        console.log(`   ✓ Row ${rowIndex}: ${passengerName}`);
      });
    }

    // =========================================
    // 4️⃣ SAVE OUTPUT FILE
    // =========================================
    console.log('\n💾 Saving filled template...');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ Successfully saved: ${outputPath}`);
    
    return {
      success: true,
      outputPath,
      weekdaysCount: year && month ? getWeekdaysInMonth(year, month).length : 0,
      passengersCount: passengerNames.length,
    };

  } catch (error) {
    console.error('❌ Error filling template:', error);
    throw error;
  }
}

// =========================================
// EXAMPLE USAGE
// =========================================
async function main() {
  try {
    const result = await fillTR1Template({
      // Input/Output
      templatePath: path.join(__dirname, 'TR1.xlsx'),
      outputPath: path.join(__dirname, 'TR1_filled.xlsx'),
      
      // Date
      year: 2024,
      month: 12, // December
      
      // Header data
      schoolName: 'Greenfield Primary School',
      refNumber: 'TR1-2024-12',
      operatorName: 'Fleet Transport Services',
      vehicleRegNo: 'AB12 CDE',
      licensingBadgeNo: 'LIC123456',
      psvDiscVehiclePlateNo: 'PSV789012',
      driverName: 'John Smith',
      driverTasNo: 'TAS-DRV-001',
      passengerAssistantNames: ['Jane Doe', 'Bob Wilson'],
      passengerAssistantTasNos: ['TAS-PA-001', 'TAS-PA-002'],
      
      // Passengers
      passengerNames: [
        'Alice Johnson',
        'Bob Williams',
        'Charlie Brown',
        'Diana Smith',
        'Ethan Davis',
      ],
      
      // Cell locations - ADJUST THESE TO MATCH YOUR TEMPLATE
      cellLocations: {
        // Header fields (example locations - update these!)
        month: 'C2',
        school: 'C3',
        refNumber: 'C4',
        operator: 'C5',
        vehicleRegNo: 'C6',
        licensingBadgeNo: 'C7',
        psvDiscVehiclePlateNo: 'C8',
        driverName: 'C9',
        driverTasNo: 'C10',
        passengerAssistantName: 'C11',
        passengerAssistantTasNo: 'C12',
        
        // Table structure
        dateRowNumber: 15, // Row where dates go
        dateStartColumn: 2, // Column B (start of weekday columns)
        passengerNameColumn: 1, // Column A
        passengerStartRow: 16, // First passenger row
      },
    });
    
    console.log('\n📊 Summary:');
    console.log(`   Weekdays filled: ${result.weekdaysCount}`);
    console.log(`   Passengers added: ${result.passengersCount}`);
    
  } catch (error) {
    console.error('Failed to fill template:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for use as module
module.exports = { fillTR1Template, getWeekdaysInMonth, getMonthName };

