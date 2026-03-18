'use client'

import { useState } from 'react'
import { VehicleSeatingPlan } from '@/lib/types'

interface SeatAssignment {
  seat_number: string
  seat_type: string
  passenger_id: number | null
  passenger_name: string | null
  mobility_type: string | null
}

interface InteractiveSeatingChartProps {
  seatingPlan: VehicleSeatingPlan
  assignments: SeatAssignment[]
  passengers: Array<{
    id: number
    full_name: string
    mobility_type: string | null
  }>
  onAssignSeat: (seatNumber: string, passengerId: number | null, seatType: string) => Promise<void>
  isReadOnly?: boolean
}

export default function InteractiveSeatingChart({
  seatingPlan,
  assignments,
  passengers,
  onAssignSeat,
  isReadOnly = false
}: InteractiveSeatingChartProps) {
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  const { rows, seats_per_row, wheelchair_spaces } = seatingPlan

  // Generate seat layout
  const generateSeats = () => {
    const seats = []
    let seatNumber = 1

    for (let row = 0; row < rows; row++) {
      const rowSeats = []
      for (let seat = 0; seat < seats_per_row; seat++) {
        if (seatNumber <= seatingPlan.total_capacity) {
          rowSeats.push({
            number: seatNumber.toString(),
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

  // Get assignment for a seat
  const getAssignment = (seatNumber: string) => {
    return assignments.find(a => a.seat_number === seatNumber)
  }

  // Check if passenger is already assigned
  const isPassengerAssigned = (passengerId: number) => {
    return assignments.some(a => a.passenger_id === passengerId)
  }

  // Handle seat click
  const handleSeatClick = (seatNumber: string) => {
    if (isReadOnly) return
    setSelectedSeat(seatNumber)
  }

  // Handle passenger assignment
  const handleAssignPassenger = async (passengerId: number | null) => {
    if (!selectedSeat || isAssigning) return

    setIsAssigning(true)
    try {
      const seatType = parseInt(selectedSeat) > seatingPlan.total_capacity - wheelchair_spaces 
        ? 'wheelchair' 
        : 'standard'
      
      await onAssignSeat(selectedSeat, passengerId, seatType)
      setSelectedSeat(null)
    } catch (error) {
      console.error('Error assigning passenger:', error)
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seating Chart */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Seating Chart</h3>
            
            <div className="space-y-6">
              {/* Driver */}
              <div className="flex justify-center">
                <div className="bg-navy rounded-lg p-3 text-center border-2 border-blue-700">
                  <div className="text-xs font-semibold text-white">🚗 Driver</div>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 uppercase">Front</div>

              {/* Seats */}
              <div className="space-y-3">
                {seatLayout.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-center gap-2">
                    <div className="w-8 text-right text-xs text-gray-500 font-mono">
                      R{rowIndex + 1}
                    </div>

                    <div className="flex gap-2">
                      {row.slice(0, Math.ceil(seats_per_row / 2)).map((seat) => {
                        const assignment = getAssignment(seat.number)
                        const isSelected = selectedSeat === seat.number
                        
                        return (
                          <button
                            key={seat.number}
                            onClick={() => handleSeatClick(seat.number)}
                            disabled={isReadOnly}
                            className={`w-12 h-12 rounded flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer
                              ${assignment 
                                ? 'bg-green-500 text-white border-2 border-green-600 hover:bg-green-600' 
                                : 'bg-blue-600 text-white border border-blue-500 hover:bg-blue-700'
                              }
                              ${isSelected ? 'ring-4 ring-yellow-400' : ''}
                              ${isReadOnly ? 'cursor-default' : ''}
                            `}
                            title={assignment ? `${assignment.passenger_name}` : `Seat ${seat.number}`}
                          >
                            <div>{seat.number}</div>
                            {assignment && assignment.mobility_type === 'Wheelchair' && (
                              <div className="text-xs">♿</div>
                            )}
                          </button>
                        )
                      })}

                      {/* Aisle */}
                      <div className="w-4 flex items-center justify-center">
                        <div className="w-px h-10 bg-gray-300"></div>
                      </div>

                      {row.slice(Math.ceil(seats_per_row / 2)).map((seat) => {
                        const assignment = getAssignment(seat.number)
                        const isSelected = selectedSeat === seat.number
                        
                        return (
                          <button
                            key={seat.number}
                            onClick={() => handleSeatClick(seat.number)}
                            disabled={isReadOnly}
                            className={`w-12 h-12 rounded flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer
                              ${assignment 
                                ? 'bg-green-500 text-white border-2 border-green-600 hover:bg-green-600' 
                                : 'bg-blue-600 text-white border border-blue-500 hover:bg-blue-700'
                              }
                              ${isSelected ? 'ring-4 ring-yellow-400' : ''}
                              ${isReadOnly ? 'cursor-default' : ''}
                            `}
                            title={assignment ? `${assignment.passenger_name}` : `Seat ${seat.number}`}
                          >
                            <div>{seat.number}</div>
                            {assignment && assignment.mobility_type === 'Wheelchair' && (
                              <div className="text-xs">♿</div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <div className="w-8 text-left text-xs text-gray-500 font-mono">
                      R{rowIndex + 1}
                    </div>
                  </div>
                ))}
              </div>

              {/* Wheelchair Section */}
              {wheelchair_spaces > 0 && (
                <>
                  <div className="text-center text-xs text-gray-500 uppercase mt-6">
                    Wheelchair Accessible Area
                  </div>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {Array.from({ length: wheelchair_spaces }).map((_, index) => {
                      const seatNum = (seatingPlan.total_capacity - wheelchair_spaces + index + 1).toString()
                      const assignment = getAssignment(seatNum)
                      const isSelected = selectedSeat === seatNum
                      
                      return (
                        <button
                          key={`wheelchair-${index}`}
                          onClick={() => handleSeatClick(seatNum)}
                          disabled={isReadOnly}
                          className={`w-16 h-16 rounded flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer
                            ${assignment 
                              ? 'bg-green-500 text-white border-2 border-green-600 hover:bg-green-600' 
                              : 'bg-yellow-500 text-gray-900 border-2 border-yellow-400 hover:bg-yellow-600'
                            }
                            ${isSelected ? 'ring-4 ring-blue-400' : ''}
                            ${isReadOnly ? 'cursor-default' : ''}
                          `}
                          title={assignment ? `${assignment.passenger_name}` : `Wheelchair Seat ${seatNum}`}
                        >
                          <div className="text-2xl">♿</div>
                          <div className="text-xs">{seatNum}</div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="text-center text-xs text-gray-500 uppercase">Back</div>

              {/* Legend */}
              <div className="mt-6 pt-4 border-t border-gray-300">
                <div className="text-sm font-semibold mb-3 text-gray-700">Legend</div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded border border-blue-500"></div>
                    <span className="text-gray-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-500 rounded border-2 border-green-600"></div>
                    <span className="text-gray-600">Assigned</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-yellow-500 rounded border-2 border-yellow-400"></div>
                    <span className="text-gray-600">Wheelchair</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Passenger List */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            {selectedSeat ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Assign Seat {selectedSeat}
                </h3>
                
                {getAssignment(selectedSeat) && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="text-sm font-medium text-green-900">Currently Assigned:</div>
                    <div className="text-sm text-green-700 mt-1">
                      {getAssignment(selectedSeat)?.passenger_name}
                    </div>
                    <button
                      onClick={() => handleAssignPassenger(null)}
                      disabled={isAssigning}
                      className="mt-2 text-xs text-red-600 hover:text-red-800"
                    >
                      Unassign
                    </button>
                  </div>
                )}

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {passengers.map((passenger) => (
                    <button
                      key={passenger.id}
                      onClick={() => handleAssignPassenger(passenger.id)}
                      disabled={isPassengerAssigned(passenger.id) || isAssigning}
                      className={`w-full text-left p-3 rounded border transition-colors
                        ${isPassengerAssigned(passenger.id)
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-400 cursor-pointer'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{passenger.full_name}</span>
                        {passenger.mobility_type === 'Wheelchair' && (
                          <span className="text-lg">♿</span>
                        )}
                      </div>
                      {passenger.mobility_type && (
                        <div className="text-xs text-gray-500 mt-1">
                          {passenger.mobility_type}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-3">🪑</div>
                <p className="text-sm">Click a seat to assign a passenger</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

