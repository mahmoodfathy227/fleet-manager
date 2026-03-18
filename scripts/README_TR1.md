# TR1 Template Filler

Node.js script to fill the Home to School Transport Record (TR1) Excel template with data while preserving all formatting.

## Installation

```bash
cd scripts
npm install
```

## Usage

### 1. Configure Cell Locations

Open `fillTR1Template.js` and update the `cellLocations` object in the example to match your actual TR1.xlsx template:

```javascript
cellLocations: {
  // Header fields - UPDATE THESE
  month: 'C2',              // Cell for month name
  school: 'C3',             // Cell for school name
  refNumber: 'C4',          // Cell for reference number
  operator: 'C5',           // Cell for operator name
  vehicleRegNo: 'C6',       // Cell for vehicle registration
  licensingBadgeNo: 'C7',   // Cell for licensing badge number
  psvDiscVehiclePlateNo: 'C8', // Cell for PSV disc/plate number
  driverName: 'C9',         // Cell for driver name
  driverTasNo: 'C10',       // Cell for driver TAS number
  passengerAssistantName: 'C11',   // Cell for PA name(s)
  passengerAssistantTasNo: 'C12',  // Cell for PA TAS number(s)
  
  // Table structure
  dateRowNumber: 15,        // Row where dates are written
  dateStartColumn: 2,       // Column B (1=A, 2=B, 3=C, etc.)
  passengerNameColumn: 1,   // Column A for passenger names
  passengerStartRow: 16,    // First row for passenger data
}
```

### 2. Run the Script

```bash
node fillTR1Template.js
```

Or with npm:

```bash
npm run fill-tr1
```

## Example Output

```
📄 Loaded template: TR1.xlsx
📋 Working with worksheet: Sheet1

📝 Filling header fields...
   ✓ Month: December
   ✓ School: Greenfield Primary School
   ✓ Ref Number: TR1-2024-12
   ✓ Operator: Fleet Transport Services
   ✓ Vehicle Reg No: AB12 CDE
   ✓ Driver Name: John Smith
   ✓ Driver TAS No: TAS-DRV-001
   ✓ Passenger Assistant Name(s): Jane Doe, Bob Wilson
   ✓ Passenger Assistant TAS No(s): TAS-PA-001, TAS-PA-002

📅 Filling weekday dates...
   Found 22 weekdays in December 2024
   ✓ Day 2 → Column 2
   ✓ Day 3 → Column 3
   ...

👥 Filling passenger names...
   ✓ Row 16: Alice Johnson
   ✓ Row 17: Bob Williams
   ...

💾 Saving filled template...
✅ Successfully saved: TR1_filled.xlsx

📊 Summary:
   Weekdays filled: 22
   Passengers added: 5
```

## Integration with Supabase/Database

To fill the template with data from your database:

```javascript
const { createClient } = require('@supabase/supabase-js');
const { fillTR1Template } = require('./fillTR1Template');

async function fillFromDatabase(routeId, year, month) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  
  // Fetch route data
  const { data: route } = await supabase
    .from('routes')
    .select(`
      route_number,
      schools(name),
      driver:driver_id(
        employees(full_name),
        tas_badge_number,
        taxi_badge_number
      ),
      pa:passenger_assistant_id(
        employees(full_name),
        tas_badge_number
      ),
      vehicles(
        registration,
        taxi_badge_number,
        taxi_license
      )
    `)
    .eq('id', routeId)
    .single();
  
  // Fetch passengers
  const { data: passengers } = await supabase
    .from('passengers')
    .select('full_name')
    .eq('route_id', routeId)
    .order('full_name');
  
  // Fill template
  await fillTR1Template({
    templatePath: './TR1.xlsx',
    outputPath: `./TR1_${route.route_number}_${year}_${month}.xlsx`,
    
    year,
    month,
    
    schoolName: route.schools?.name,
    refNumber: route.route_number,
    operatorName: 'Fleet Transport Services',
    vehicleRegNo: route.vehicles?.registration,
    licensingBadgeNo: route.driver?.taxi_badge_number || route.vehicles?.taxi_badge_number,
    psvDiscVehiclePlateNo: route.vehicles?.taxi_badge_number,
    driverName: route.driver?.employees?.full_name,
    driverTasNo: route.driver?.tas_badge_number,
    passengerAssistantNames: [route.pa?.employees?.full_name].filter(Boolean),
    passengerAssistantTasNos: [route.pa?.tas_badge_number].filter(Boolean),
    
    passengerNames: passengers.map(p => p.full_name),
  });
}

// Usage
fillFromDatabase(123, 2024, 12);
```

## Key Features

✅ **Preserves Formatting**: All borders, fonts, colors, and column widths remain unchanged
✅ **Weekdays Only**: Automatically filters out weekends (Saturday/Sunday)
✅ **Day Numbers Only**: Writes only the day number (1, 2, 3...), not full dates
✅ **Multiple PAs**: Supports multiple passenger assistants (comma-separated)
✅ **Flexible Layout**: Cell locations are configurable to match your template

## Troubleshooting

### "Cell not found" errors
- Check that your cell locations in `cellLocations` match your actual template
- Open TR1.xlsx in Excel and verify the cell references

### Dates in wrong columns
- Adjust `dateStartColumn` to match where your weekday columns begin
- Remember: 1=A, 2=B, 3=C, etc.

### Passenger names not appearing
- Verify `passengerStartRow` matches your template's first passenger row
- Check that `passengerNameColumn` is correct (usually column A = 1)

## License

MIT

