# TR1 Form Export Setup

## 📋 Overview

The TR1 (Home to School Transport Record) export feature allows you to generate filled Excel forms for each route with one click.

## 🚀 Setup Instructions

### 1. Install ExcelJS Dependency

```bash
npm install exceljs
# or
yarn add exceljs
```

### 2. Add TR1 Template to Your Project

1. Create the templates directory:
```bash
mkdir -p public/templates
```

2. Place your `TR1.xlsx` template file in `public/templates/`

The template should have:
- All borders and formatting pre-configured
- Header fields for route/vehicle/driver/PA information
- A table with columns for weekday dates
- Rows for passenger names

### 3. Configure Cell Locations

Open `app/api/routes/[id]/export-tr1/route.ts` and update the `cellLocations` object to match your actual TR1 template:

```typescript
const cellLocations = {
  // Header fields - UPDATE THESE TO MATCH YOUR TEMPLATE
  month: 'C2',              // Cell for month name
  school: 'C3',             // Cell for school name
  refNumber: 'C4',          // Cell for reference number
  operator: 'C5',           // Cell for operator name
  vehicleRegNo: 'C6',       // Cell for vehicle registration
  licensingBadgeNo: 'C7',   // Cell for licensing badge number
  psvDiscVehiclePlateNo: 'C8', // Cell for PSV disc/plate
  driverName: 'C9',         // Cell for driver name
  driverTasNo: 'C10',       // Cell for driver TAS number
  passengerAssistantName: 'C11',   // Cell for PA name
  passengerAssistantTasNo: 'C12',  // Cell for PA TAS number
  
  // Table structure - UPDATE THESE TOO
  dateRowNumber: 15,        // Row where dates are written
  dateStartColumn: 2,       // Column B (1=A, 2=B, 3=C, etc.)
  passengerNameColumn: 1,   // Column A for passenger names
  passengerStartRow: 16,    // First row for passenger data
}
```

### 4. Update Operator Name (Optional)

In the same file, find this line and update with your company name:

```typescript
worksheet.getCell(cellLocations.operator).value = 'Fleet Transport Services'
```

## 📖 How to Use

### From Route Detail Page

1. Navigate to any route: `/dashboard/routes/{id}`
2. Click **"Export TR1 (Current Month)"** for the current month
3. Or click **"Choose Month"** to select a specific month/year
4. The Excel file downloads automatically

### Features

✅ **Auto-fills all data:**
- Month and year
- School name
- Route number (as reference)
- Vehicle registration and license info
- Driver name and TAS badge number
- PA name and TAS badge number
- All passenger names

✅ **Weekdays only:**
- Automatically calculates Monday-Friday dates
- Excludes weekends
- Writes only day numbers (1, 2, 3...)

✅ **Preserves formatting:**
- All borders remain intact
- Colors and fonts unchanged
- Column widths preserved

## 🔧 API Endpoint

### GET `/api/routes/{id}/export-tr1`

**Query Parameters:**
- `year` (optional): Year for the form (default: current year)
- `month` (optional): Month 1-12 (default: current month)

**Example:**
```
GET /api/routes/123/export-tr1?year=2024&month=12
```

**Response:**
- Excel file download
- Filename: `TR1_{RouteNumber}_{Month}_{Year}.xlsx`

## 📁 File Structure

```
your-project/
├── app/
│   ├── api/
│   │   └── routes/
│   │       └── [id]/
│   │           └── export-tr1/
│   │               └── route.ts          # API endpoint
│   └── dashboard/
│       └── routes/
│           └── [id]/
│               ├── page.tsx              # Updated with export button
│               └── ExportTR1Button.tsx   # Export UI component
├── public/
│   └── templates/
│       └── TR1.xlsx                      # Your template (ADD THIS!)
└── package.json                          # Add exceljs dependency
```

## 🐛 Troubleshooting

### "TR1 template not found" error
- Ensure `TR1.xlsx` is in `public/templates/`
- Check file permissions

### Data appearing in wrong cells
- Open your TR1.xlsx in Excel
- Verify cell references (e.g., is Month in C2?)
- Update `cellLocations` to match

### Dates in wrong columns
- Check `dateStartColumn` (remember: 1=A, 2=B, 3=C)
- Verify `dateRowNumber` matches your template

### Passenger names not showing
- Verify `passengerStartRow` matches first passenger row
- Check that `passengerNameColumn` is correct (usually 1 for column A)

### ExcelJS not found
- Run `npm install exceljs`
- Restart your dev server

## 💡 Customization

### Add More Fields

To add custom fields, edit the API route:

```typescript
// Example: Add route points/stops
const { data: routePoints } = await supabase
  .from('route_points')
  .select('*')
  .eq('route_id', routeId)
  .order('stop_order')

// Then write to a cell
worksheet.getCell('C15').value = routePoints.length + ' stops'
```

### Different Template Per School

```typescript
// In the API route, choose template based on school
const school = route.schools
const templateName = school?.name.includes('Primary') 
  ? 'TR1_Primary.xlsx' 
  : 'TR1_Secondary.xlsx'

const templatePath = path.join(process.cwd(), 'public', 'templates', templateName)
```

### Bulk Export

Create a page to export TR1 for all routes:

```typescript
// app/dashboard/routes/export-all-tr1/page.tsx
async function exportAllRoutes(month: number, year: number) {
  const { data: routes } = await supabase.from('routes').select('id')
  
  for (const route of routes) {
    await fetch(`/api/routes/${route.id}/export-tr1?year=${year}&month=${month}`)
  }
}
```

## 📊 Data Sources

The export pulls data from:
- `routes` table (route number, assignments)
- `schools` table (school name)
- `vehicles` table (registration, licenses)
- `drivers` table (TAS badge number)
- `passenger_assistants` table (TAS badge number)
- `employees` table (driver/PA names)
- `passengers` table (passenger names)

## ✅ Checklist

- [ ] ExcelJS installed (`npm install exceljs`)
- [ ] TR1.xlsx template in `public/templates/`
- [ ] Cell locations configured in API route
- [ ] Operator name updated
- [ ] Template tested with one route
- [ ] All data fields appearing correctly

## 📞 Support

If dates or data appear in wrong cells:
1. Open TR1.xlsx in Excel
2. Note the exact cell references (e.g., A1, B2, C3)
3. Update `cellLocations` in the API route
4. Test again

