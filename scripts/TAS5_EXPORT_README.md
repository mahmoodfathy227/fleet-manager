# TAS 5 Export Script

This script fills the TAS 5.xlsx template with route details from a school profile.

## 📁 File Structure

```
your-project/
├── scripts/
│   ├── fillTAS5Template.js    # Main script (similar to fillTR1Template.js)
│   └── TAS5_EXPORT_README.md  # This file
├── public/
│   └── templates/
│       └── TAS 5.xlsx         # Your TAS 5 template (ADD THIS!)
└── app/
    └── api/
        └── schools/
            └── [id]/
                └── export-tas5/
                    └── route.ts  # API endpoint for export
```

## 🚀 Quick Start

### 1. Place Your Template

Place your `TAS 5.xlsx` template in:
```
public/templates/TAS 5.xlsx
```

### 2. Update Cell Locations

Open `scripts/fillTAS5Template.js` and update the `cellLocations` object to match your template:

```javascript
cellLocations: {
  // School information - Update these cell references
  schoolName: 'B2',        // Change to your cell (e.g., 'C3')
  schoolAddress: 'B3',     // Change to your cell
  schoolRefNumber: 'B4',   // Change to your cell
  schoolPhone: 'B5',       // Change to your cell
  schoolEmail: 'B6',       // Change to your cell
  
  // Route table structure
  routeTableStartRow: 10,  // Row where first route starts
  
  // Route columns (1=A, 2=B, 3=C, etc.)
  routeNumberColumn: 1,    // Column for route number
  routeStartTimeColumn: 2, // Column for start time
  // ... etc
}
```

### 3. Test the Script

Run the script directly to test:
```bash
node scripts/fillTAS5Template.js
```

Or use it as a module:
```javascript
const { fillTAS5Template } = require('./scripts/fillTAS5Template');

await fillTAS5Template({
  templatePath: './TAS 5.xlsx',
  outputPath: './TAS5_filled.xlsx',
  schoolName: 'My School',
  routes: [/* your route data */],
  cellLocations: { /* your cell locations */ }
});
```

## 📊 Data Structure

The script expects route data in this format:

```javascript
{
  schoolName: 'School Name',
  schoolAddress: '123 Address',
  schoolRefNumber: 'SCH-001',
  schoolPhone: '01234 567890',
  schoolEmail: 'school@example.com',
  routes: [
    {
      route_number: 'R001',
      am_start_time: '08:00:00',
      pm_start_time: '15:30:00',
      driver: {
        employees: { full_name: 'John Smith' },
        tas_badge_number: 'TAS-001',
      },
      pa: {
        employees: { full_name: 'Jane Doe' },
        tas_badge_number: 'TAS-PA-001',
      },
      vehicles: {
        registration: 'AB12 CDE',
        plate_number: 'PLATE123',
      },
      passengers: [
        { full_name: 'Alice Johnson' },
        { full_name: 'Bob Williams' },
      ],
      notes: 'Optional route notes',
    }
  ]
}
```

## 🌐 API Endpoint

### GET `/api/schools/{id}/export-tas5`

Exports TAS 5 for a school with all its routes.

**Example:**
```
GET /api/schools/123/export-tas5
```

**Response:**
- Excel file download
- Filename: `TAS5_{SchoolName}_{Date}.xlsx`

## 🔧 Customization

### Adding More Fields

To add more fields to the export:

1. **In the script** (`fillTAS5Template.js`):
   - Add the field to the `cellLocations` object
   - Add logic to fill the cell in the route loop

2. **In the API** (`app/api/schools/[id]/export-tas5/route.ts`):
   - Add the field to the `cellLocations` object
   - Add logic to extract and fill the data

### Example: Adding Route Points

```javascript
// In cellLocations
routePointsColumn: 12, // Column L

// In the route loop
if (route.route_points && route.route_points.length > 0) {
  const points = route.route_points.map(p => p.point_name).join(', ');
  worksheet.getCell(rowIndex, cellLocations.routePointsColumn).value = points;
}
```

## 📝 Notes

- The script preserves all Excel formatting (borders, colors, fonts)
- Empty values are handled gracefully (won't break the template)
- Time values are automatically formatted from HH:MM:SS to HH:MM
- You can customize which fields to include/exclude

## 🐛 Troubleshooting

### "TAS 5 template not found" error
- Ensure `TAS 5.xlsx` exists in `public/templates/`
- Check the file name matches exactly (case-sensitive)

### Data not appearing in correct cells
- Open your template in Excel and note the exact cell references
- Update the `cellLocations` object in both the script and API endpoint

### Routes not showing
- Check that routes are being fetched correctly
- Verify the `routeTableStartRow` is correct
- Ensure column numbers match your template layout
