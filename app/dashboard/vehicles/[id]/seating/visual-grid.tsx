'use client'

import { VehicleSeatingPlan } from '@/lib/types'

interface VisualSeatingGridProps {
  seatingPlan: VehicleSeatingPlan
}

export default function VisualSeatingGrid({ seatingPlan }: VisualSeatingGridProps) {
  const { rows, seats_per_row, wheelchair_spaces, total_capacity } = seatingPlan

  // Generate seat layout
  const generateSeats = () => {
    const seats = []
    let seatNumber = 1

    for (let row = 0; row < rows; row++) {
      const rowSeats = []
      for (let seat = 0; seat < seats_per_row; seat++) {
        if (seatNumber <= total_capacity) {
          rowSeats.push({
            number: seatNumber,
            type: 'standard' as const
          })
          seatNumber++
        }
      }
      seats.push(rowSeats)
    }

    return seats
  }

  const seatLayout = generateSeats()

  return (
    <div className="space-y-6 py-4">
      {/* Driver section */}
      <div className="flex justify-center">
        <div className="bg-navy rounded-lg p-4 text-center border-2 border-blue-700">
          <div className="text-sm font-semibold text-black">🚗 Driver</div>
        </div>
      </div>

      {/* Aisle indicator */}
      <div className="text-center text-xs text-slate-500 uppercase tracking-wider">
        Front of Vehicle
      </div>

      {/* Seat rows */}
      <div className="space-y-3">
        {seatLayout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center justify-center gap-2">
            {/* Row number */}
            <div className="w-8 text-right text-xs text-slate-500 font-mono">
              R{rowIndex + 1}
            </div>

            {/* Seats */}
            <div className="flex gap-2">
              {row.slice(0, Math.ceil(seats_per_row / 2)).map((seat) => (
                <div
                  key={seat.number}
                  className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-xs font-semibold hover:bg-blue-700 transition-colors cursor-default border border-blue-500 text-white"
                  title={`Seat ${seat.number}`}
                >
                  {seat.number}
                </div>
              ))}

              {/* Aisle */}
              <div className="w-4 flex items-center justify-center">
                <div className="w-px h-8 bg-slate-300"></div>
              </div>

              {row.slice(Math.ceil(seats_per_row / 2)).map((seat) => (
                <div
                  key={seat.number}
                  className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-xs font-semibold hover:bg-blue-700 transition-colors cursor-default border border-blue-500 text-white"
                  title={`Seat ${seat.number}`}
                >
                  {seat.number}
                </div>
              ))}
            </div>

            {/* Row number (right side) */}
            <div className="w-8 text-left text-xs text-slate-500 font-mono">
              R{rowIndex + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Wheelchair section */}
      {wheelchair_spaces > 0 && (
        <>
          <div className="text-center text-xs text-slate-500 uppercase tracking-wider mt-6">
            Wheelchair Accessible Area
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            {Array.from({ length: wheelchair_spaces }).map((_, index) => (
              <div
                key={`wheelchair-${index}`}
                className="w-14 h-14 bg-yellow-500 rounded flex items-center justify-center text-2xl hover:bg-yellow-600 transition-colors cursor-default border-2 border-yellow-400"
                title={`Wheelchair Space ${index + 1}`}
              >
                ♿
              </div>
            ))}
          </div>
        </>
      )}

      {/* Back of vehicle indicator */}
      <div className="text-center text-xs text-slate-500 uppercase tracking-wider">
        Back of Vehicle
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-slate-300">
        <div className="text-sm font-semibold mb-3 text-slate-700">Legend</div>
        <div className="flex flex-wrap gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded border border-blue-500"></div>
            <span className="text-slate-600">Standard Seat</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-500 rounded border-2 border-yellow-400 flex items-center justify-center text-sm">
              ♿
            </div>
            <span className="text-slate-600">Wheelchair Space</span>
          </div>
        </div>
      </div>

      {/* Capacity summary */}
      <div className="mt-6 p-5 bg-slate-50 rounded-lg border border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
          <div>
            <div className="text-slate-600 mb-1">Total Capacity</div>
            <div className="text-lg font-bold text-slate-900">{total_capacity}</div>
          </div>
          <div>
            <div className="text-slate-600 mb-1">Rows</div>
            <div className="text-lg font-bold text-slate-900">{rows}</div>
          </div>
          <div>
            <div className="text-slate-600 mb-1">Seats/Row</div>
            <div className="text-lg font-bold text-slate-900">{seats_per_row}</div>
          </div>
          <div>
            <div className="text-slate-600 mb-1">Wheelchair</div>
            <div className="text-lg font-bold text-yellow-600">{wheelchair_spaces}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

