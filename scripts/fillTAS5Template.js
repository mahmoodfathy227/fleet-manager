/**
 * TAS 5 Excel Template Filler
 * Fills the TAS 5 template with route details while preserving formatting.
 *
 * ✅ Column requirements (1–17):
 * 1  FPS number
 * 2  Name of school
 * 3  Empty (leave as-is)
 * 4  Vehicle ID
 * 5  Vehicle registration assigned to this route
 * 6  Number of seats
 * 7  Vehicle type
 * 8  D1 category number (if applicable)
 * 9  PSV expiry date
 * 10 Capacity
 * 11 Make and model of car
 * 12 Driver name
 * 13 Driver TAS number
 * 14 Driver TAS number expiry
 * 15 PA name
 * 16 PA TAS number
 * 17 PA TAS expiry
 */

const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Format time from HH:MM:SS or HH:MM to HH:MM format
 * @param {string} time
 * @returns {string}
 */
function formatTime(time) {
  if (!time) return '';
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.substring(0, 5);
  return String(time);
}

/**
 * Format date to DD/MM/YYYY
 * @param {string|Date} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Safely unwrap object that might be array
 * @param {any} val
 * @returns {any|null}
 */
function unwrapFirst(val) {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

/**
 * Fill the TAS 5 template with route data
 * @param {Object} options
 */
async function fillTAS5Template(options) {
  const {
    // Input/Output files
    templatePath = './TAS 5.xlsx',
    outputPath = './TAS5_filled.xlsx',

    // School data
    schoolFps, // schools.ref_number (FPS)
    schoolName, // schools.name

    // Route data
    routes = [],

    // Worksheet name
    worksheetName = 'Sheet1',

    // Cell locations (column numbers)
    cellLocations = {
      routeTableStartRow: 7,
      routeTableStartColumn: 1,

      fpsColumn: 1, // Col 1
      schoolNameColumn: 2, // Col 2
      emptyColumn: 3, // Col 3 (leave as-is)

      vehicleIdColumn: 4, // Col 4
      vehicleRegColumn: 5, // Col 5
      seatsColumn: 6, // Col 6
      vehicleTypeColumn: 7, // Col 7
      d1CategoryNumberColumn: 8, // Col 8
      psvExpiryDateColumn: 9, // Col 9
      capacityColumn: 10, // Col 10
      makeModelColumn: 11, // Col 11

      driverNameColumn: 12, // Col 12
      driverTasColumn: 13, // Col 13
      driverTasExpiryColumn: 14, // Col 14

      paNameColumn: 15, // Col 15
      paTasColumn: 16, // Col 16
      paTasExpiryColumn: 17, // Col 17
    },
  } = options;

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet =
      workbook.getWorksheet(worksheetName) || workbook.getWorksheet(1);

    if (!worksheet) throw new Error('Worksheet not found in template');

    console.log(`📄 Loaded template: ${templatePath}`);
    console.log(`📋 Working with worksheet: ${worksheet.name}`);

    if (routes && routes.length > 0) {
      console.log(`\n🚌 Filling ${routes.length} row(s)...`);
      console.log(`   Starting at row ${cellLocations.routeTableStartRow}`);

      routes.forEach((route, index) => {
        const rowIndex = cellLocations.routeTableStartRow + index;

        const driver = unwrapFirst(route.driver);
        const pa = unwrapFirst(route.pa);
        const vehicle = unwrapFirst(route.vehicles || route.vehicle);

        // 1) FPS number
        if (schoolFps) {
          worksheet.getCell(rowIndex, cellLocations.fpsColumn).value =
            String(schoolFps);
        }

        // 2) Name of school
        if (schoolName) {
          worksheet.getCell(rowIndex, cellLocations.schoolNameColumn).value =
            String(schoolName);
        } else if (route.schoolName) {
          worksheet.getCell(rowIndex, cellLocations.schoolNameColumn).value =
            String(route.schoolName);
        }

        // 3) Empty: do nothing (preserve template)
        // worksheet.getCell(rowIndex, cellLocations.emptyColumn).value = '';

        // 4) Vehicle ID
        if (vehicle) {
          const vehicleId =
            vehicle.id ??
            vehicle.vehicle_id ??
            vehicle.vehicle_identifier ??
            route.vehicle_id ??
            '';
          if (vehicleId !== '') {
            worksheet.getCell(rowIndex, cellLocations.vehicleIdColumn).value =
              String(vehicleId);
          }
        } else if (route.vehicle_id) {
          worksheet.getCell(rowIndex, cellLocations.vehicleIdColumn).value =
            String(route.vehicle_id);
        }

        // 5) Vehicle registration assigned to this route
        if (vehicle) {
          const reg = vehicle.registration ?? vehicle.plate_number ?? '';
          if (reg) {
            worksheet.getCell(rowIndex, cellLocations.vehicleRegColumn).value =
              String(reg);
          }
        } else if (route.vehicle_registration) {
          worksheet.getCell(rowIndex, cellLocations.vehicleRegColumn).value =
            String(route.vehicle_registration);
        }

        // 6) Number of seats
        // (join from vehicle_configurations.seats_total or seating plan total_capacity -> pass in query)
        if (vehicle) {
          const seats =
            vehicle.seats_total ??
            vehicle.number_of_seats ??
            vehicle.seats ??
            '';
          if (seats !== '') {
            worksheet.getCell(rowIndex, cellLocations.seatsColumn).value =
              Number(seats);
          }
        } else if (route.number_of_seats != null) {
          worksheet.getCell(rowIndex, cellLocations.seatsColumn).value =
            Number(route.number_of_seats);
        }

        // 7) Vehicle type
        if (vehicle) {
          const vType = vehicle.vehicle_type ?? vehicle.type ?? '';
          if (vType) {
            worksheet.getCell(rowIndex, cellLocations.vehicleTypeColumn).value =
              String(vType);
          }
        } else if (route.vehicle_type) {
          worksheet.getCell(rowIndex, cellLocations.vehicleTypeColumn).value =
            String(route.vehicle_type);
        }

        // 8) D1 category number (if applicable)
        // (not in schema snippet; fill if you pass it in)
        const d1 =
          route.d1_category_number ??
          driver?.d1_category_number ??
          vehicle?.d1_category_number ??
          '';
        if (d1) {
          worksheet.getCell(
            rowIndex,
            cellLocations.d1CategoryNumberColumn
          ).value = String(d1);
        }

        // 9) PSV expiry date
        // (not explicit in schema snippet; fill if passed in; else blank)
        const psvExpiry =
          route.psv_expiry_date ??
          vehicle?.psv_expiry_date ??
          vehicle?.psv_license_expiry_date ??
          '';
        if (psvExpiry) {
          worksheet.getCell(rowIndex, cellLocations.psvExpiryDateColumn).value =
            formatDate(psvExpiry);
        }

        // 10) Capacity
        // (commonly from vehicle_seating_plans.total_capacity -> pass in)
        if (vehicle) {
          const capacity = vehicle.total_capacity ?? vehicle.capacity ?? '';
          if (capacity !== '') {
            worksheet.getCell(rowIndex, cellLocations.capacityColumn).value =
              Number(capacity);
          }
        } else if (route.capacity != null) {
          worksheet.getCell(rowIndex, cellLocations.capacityColumn).value =
            Number(route.capacity);
        }

        // 11) Make and model of car
        if (vehicle) {
          const make = vehicle.make ?? '';
          const model = vehicle.model ?? '';
          const makeModel = [make, model].filter(Boolean).join(' ');
          if (makeModel) {
            worksheet.getCell(rowIndex, cellLocations.makeModelColumn).value =
              makeModel;
          }
        } else if (route.make_model) {
          worksheet.getCell(rowIndex, cellLocations.makeModelColumn).value =
            String(route.make_model);
        }

        // 12) Driver name
        if (driver) {
          const driverName =
            driver?.employees?.full_name ?? driver?.full_name ?? '';
          if (driverName) {
            worksheet.getCell(rowIndex, cellLocations.driverNameColumn).value =
              String(driverName);
          }
        } else if (route.driver_name) {
          worksheet.getCell(rowIndex, cellLocations.driverNameColumn).value =
            String(route.driver_name);
        }

        // 13) Driver TAS number
        if (driver) {
          const driverTas = driver?.tas_badge_number ?? '';
          if (driverTas) {
            worksheet.getCell(rowIndex, cellLocations.driverTasColumn).value =
              String(driverTas);
          }
        } else if (route.driver_tas_number) {
          worksheet.getCell(rowIndex, cellLocations.driverTasColumn).value =
            String(route.driver_tas_number);
        }

        // 14) Driver TAS number expiry
        if (driver) {
          const exp = driver?.tas_badge_expiry_date ?? '';
          if (exp) {
            worksheet.getCell(
              rowIndex,
              cellLocations.driverTasExpiryColumn
            ).value = formatDate(exp);
          }
        } else if (route.driver_tas_expiry) {
          worksheet.getCell(rowIndex, cellLocations.driverTasExpiryColumn).value =
            formatDate(route.driver_tas_expiry);
        }

        // 15) PA name
        if (pa) {
          const paName = pa?.employees?.full_name ?? '';
          if (paName) {
            worksheet.getCell(rowIndex, cellLocations.paNameColumn).value =
              String(paName);
          }
        } else if (route.pa_name) {
          worksheet.getCell(rowIndex, cellLocations.paNameColumn).value =
            String(route.pa_name);
        }

        // 16) PA TAS number
        if (pa) {
          const paTas = pa?.tas_badge_number ?? '';
          if (paTas) {
            worksheet.getCell(rowIndex, cellLocations.paTasColumn).value =
              String(paTas);
          }
        } else if (route.pa_tas_number) {
          worksheet.getCell(rowIndex, cellLocations.paTasColumn).value =
            String(route.pa_tas_number);
        }

        // 17) PA TAS expiry
        if (pa) {
          const exp = pa?.tas_badge_expiry_date ?? '';
          if (exp) {
            worksheet.getCell(rowIndex, cellLocations.paTasExpiryColumn).value =
              formatDate(exp);
          }
        } else if (route.pa_tas_expiry) {
          worksheet.getCell(rowIndex, cellLocations.paTasExpiryColumn).value =
            formatDate(route.pa_tas_expiry);
        }
      });
    } else {
      console.log('\nℹ️ No routes provided. Nothing to fill.');
    }

    console.log('\n💾 Saving filled template...');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ Successfully saved: ${outputPath}`);

    return {
      success: true,
      outputPath,
      routesCount: routes ? routes.length : 0,
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
    const result = await fillTAS5Template({
      templatePath: path.join(__dirname, 'TAS 5.xlsx'),
      outputPath: path.join(__dirname, 'TAS5_filled.xlsx'),

      // School
      schoolFps: 'FPS-001',
      schoolName: 'Example School',

      // Routes (each route becomes 1 row starting at routeTableStartRow)
      routes: [
        {
          // You can pass these in whatever shape you fetch;
          // The filler supports nested objects like your old script.
          vehicles: {
            id: 101,
            registration: 'AB12 CDE',
            make: 'Ford',
            model: 'Transit',
            vehicle_type: 'Minibus',
            seats_total: 16, // optional
            total_capacity: 16, // optional
            // psv_expiry_date: '2026-11-30', // optional if you have it
          },
          driver: {
            employees: { full_name: 'John Smith' },
            tas_badge_number: 'TAS-DRV-001',
            tas_badge_expiry_date: '2026-06-01',
          },
          pa: {
            employees: { full_name: 'Jane Doe' },
            tas_badge_number: 'TAS-PA-001',
            tas_badge_expiry_date: '2026-07-15',
          },

          // Optional extra fields if you have them:
          // d1_category_number: 'D1-12345',
          // psv_expiry_date: '2026-12-10',
        },
      ],

      // If your template uses different start row:
      cellLocations: {
        routeTableStartRow: 7,

        fpsColumn: 1,
        schoolNameColumn: 2,
        emptyColumn: 3,

        vehicleIdColumn: 4,
        vehicleRegColumn: 5,
        seatsColumn: 6,
        vehicleTypeColumn: 7,
        d1CategoryNumberColumn: 8,
        psvExpiryDateColumn: 9,
        capacityColumn: 10,
        makeModelColumn: 11,

        driverNameColumn: 12,
        driverTasColumn: 13,
        driverTasExpiryColumn: 14,

        paNameColumn: 15,
        paTasColumn: 16,
        paTasExpiryColumn: 17,
      },
    });

    console.log('\n📊 Summary:');
    console.log(`   Rows filled: ${result.routesCount}`);
  } catch (error) {
    console.error('Failed to fill template:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fillTAS5Template, formatTime, formatDate };