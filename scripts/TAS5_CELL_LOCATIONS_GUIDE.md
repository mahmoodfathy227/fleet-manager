# TAS 5 Cell Locations Guide

## 📍 Where to Configure Cell Locations

Cell locations are configured in **TWO places** (they must match):

1. **`scripts/fillTAS5Template.js`** (lines 60-84)
   - Used when running the script directly
   - Default values in the function parameters

2. **`app/api/schools/[id]/export-tas5/route.ts`** (lines 145-168)
   - Used by the API endpoint
   - Must match the script's cell locations

## 🔍 How to Find Cell Locations

1. Open your `TAS 5.xlsx` template in Excel
2. Click on the cell where data should appear
3. Look at the **formula bar** - it shows the cell reference (e.g., `B2`, `C5`, `D10`)
4. Update the corresponding value in the code

### Example:
```
If school name should go in cell D3:
  Change: schoolName: 'B2'
  To:     schoolName: 'D3'
```

## 📊 How Multiple Rows Are Filled

The script automatically fills **one route per row**, starting from `routeTableStartRow`.

### Row Calculation Formula:
```javascript
rowIndex = routeTableStartRow + routeIndex
```

### Visual Example:

If `routeTableStartRow = 10` and you have 5 routes:

```
Excel Row | Route Index | Calculation | Route Data
----------|-------------|-------------|------------
Row 10    | Route 0     | 10 + 0 = 10 | First route
Row 11    | Route 1     | 10 + 1 = 11 | Second route
Row 12    | Route 2     | 10 + 2 = 12 | Third route
Row 13    | Route 3     | 10 + 3 = 13 | Fourth route
Row 14    | Route 4     | 10 + 4 = 14 | Fifth route
```

### Column Layout Example:

If your template has this layout:

```
        |  A  |    B    |    C    |   D   |   E   |   F   |   G   |   H   |   I   |   J   |   K   |
--------|-----|---------|---------|-------|-------|-------|-------|-------|-------|-------|-------|
Row 10  | R01 | 08:00   | 15:30   | John  | TAS01 | Jane  | TAS02 | AB12  | PLT1  |   5   | Notes |
Row 11  | R02 | 08:15   | 15:45   | Mike  | TAS03 | Sarah | TAS04 | XY98  | PLT2  |   3   | Notes |
Row 12  | R03 | 08:30   | 16:00   | Tom   | TAS05 | Emma  | TAS06 | CD34  | PLT3  |   7   | Notes |
```

Your `cellLocations` should be:
```javascript
{
  routeTableStartRow: 10,        // First route starts at row 10
  routeNumberColumn: 1,          // Column A (1)
  routeStartTimeColumn: 2,        // Column B (2)
  routeEndTimeColumn: 3,          // Column C (3)
  driverNameColumn: 4,            // Column D (4)
  driverTasColumn: 5,             // Column E (5)
  paNameColumn: 6,                // Column F (6)
  paTasColumn: 7,                 // Column G (7)
  vehicleRegColumn: 8,            // Column H (8)
  vehiclePlateColumn: 9,          // Column I (9)
  passengerCountColumn: 10,       // Column J (10)
  routeNotesColumn: 11,           // Column K (11)
}
```

## 🎯 Column Number Reference

| Column Letter | Column Number | Use in Code |
|---------------|---------------|-------------|
| A             | 1             | `routeNumberColumn: 1` |
| B             | 2             | `routeStartTimeColumn: 2` |
| C             | 3             | `routeEndTimeColumn: 3` |
| D             | 4             | `driverNameColumn: 4` |
| E             | 5             | `driverTasColumn: 5` |
| F             | 6             | `paNameColumn: 6` |
| G             | 7             | `paTasColumn: 7` |
| H             | 8             | `vehicleRegColumn: 8` |
| I             | 9             | `vehiclePlateColumn: 9` |
| J             | 10            | `passengerCountColumn: 10` |
| K             | 11            | `routeNotesColumn: 11` |
| ...           | ...           | ... |

## ✅ Quick Checklist

- [ ] Open your `TAS 5.xlsx` template in Excel
- [ ] Note the cell where school name goes → Update `schoolName`
- [ ] Note the cell where school address goes → Update `schoolAddress`
- [ ] Note the cell where school ref number goes → Update `schoolRefNumber`
- [ ] Note the cell where school phone goes → Update `schoolPhone`
- [ ] Note the cell where school email goes → Update `schoolEmail`
- [ ] Find the row where the first route data starts → Update `routeTableStartRow`
- [ ] Check which column is Route Number → Update `routeNumberColumn`
- [ ] Check which column is Start Time → Update `routeStartTimeColumn`
- [ ] Check which column is End Time → Update `routeEndTimeColumn`
- [ ] Check which column is Driver Name → Update `driverNameColumn`
- [ ] Check which column is Driver TAS → Update `driverTasColumn`
- [ ] Check which column is PA Name → Update `paNameColumn`
- [ ] Check which column is PA TAS → Update `paTasColumn`
- [ ] Check which column is Vehicle Registration → Update `vehicleRegColumn`
- [ ] Check which column is Vehicle Plate → Update `vehiclePlateColumn`
- [ ] Check which column is Passenger Count → Update `passengerCountColumn`
- [ ] Check which column is Route Notes → Update `routeNotesColumn`
- [ ] Update **BOTH** files: `fillTAS5Template.js` AND `export-tas5/route.ts`

## 🚨 Important Notes

1. **Both files must match**: The cell locations in `fillTAS5Template.js` and `export-tas5/route.ts` must be identical.

2. **Row numbers start at 1**: In Excel, row 1 is the first row. If your route table starts at row 10, use `routeTableStartRow: 10`.

3. **Column numbers start at 1**: Column A = 1, Column B = 2, etc.

4. **Multiple routes = multiple rows**: Each route gets its own row, automatically calculated.

5. **Empty cells are OK**: If a route doesn't have a driver, PA, or vehicle, that cell will be left empty (won't break the template).

## 📝 Example Configuration

If your template looks like this:

```
Row 2:  School Name: [Cell D2]
Row 3:  School Address: [Cell D3]
Row 4:  School Ref: [Cell D4]
Row 5:  School Phone: [Cell D5]
Row 6:  School Email: [Cell D6]

Row 8:  [Headers: Route | Time | Driver | ...]
Row 9:  [Headers: Number | AM/PM | Name | ...]
Row 10: [First route data starts here]
Row 11: [Second route data]
Row 12: [Third route data]
...
```

Your configuration would be:
```javascript
{
  schoolName: 'D2',
  schoolAddress: 'D3',
  schoolRefNumber: 'D4',
  schoolPhone: 'D5',
  schoolEmail: 'D6',
  routeTableStartRow: 10,  // First route starts at row 10
  routeNumberColumn: 1,     // Column A
  routeStartTimeColumn: 2,  // Column B
  // ... etc
}
```
