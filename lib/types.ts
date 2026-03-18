// ====================================================
// TypeScript Types for Fleet Management System
// ====================================================

export interface Employee {
  id: number
  full_name: string
  role: string | null
  employment_status: string | null
  phone_number: string | null
  personal_email: string | null
  address: string | null
  start_date: string | null
  end_date: string | null
  wheelchair_access: boolean | null
  created_at: string
  updated_at: string
}

export interface User {
  id: number
  employee_id: number | null
  email: string
  role: string | null
  full_name?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface Driver {
  employee_id: number
  tas_badge_number: string | null
  tas_badge_expiry_date: string | null
  dbs_expiry_date: string | null
  psv_license: boolean | null
  updated_at: string
}

export interface PassengerAssistant {
  id: number
  employee_id: number
  qr_token: string | null
  tas_badge_number: string | null
  tas_badge_expiry_date: string | null
  dbs_expiry_date: string | null
  created_at: string
  updated_at: string
}

export interface School {
  id: number
  name: string
  address: string | null
  ref_number: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface Route {
  id: number
  route_number: string | null
  school_id: number | null
  created_at: string
  updated_at: string
}

export interface Passenger {
  id: number
  full_name: string
  dob: string | null
  address: string | null
  sen_requirements: string | null
  school_id: number | null
  mobility_type: string | null
  route_id: number | null
  seat_number: string | null
  updated_at: string
}

export interface ParentContact {
  id: number
  full_name: string
  relationship: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface PassengerParentContact {
  id: number
  passenger_id: number
  parent_contact_id: number
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: number
  vehicle_identifier: string | null
  registration: string | null
  make: string | null
  model: string | null
  plate_number: string | null
  plate_expiry_date: string | null
  vehicle_type: string | null
  ownership_type: string | null
  mot_date: string | null
  tax_date: string | null
  insurance_expiry_date: string | null
  tail_lift: boolean | null
  loler_expiry_date: string | null
  last_serviced: string | null
  service_booked_day: string | null
  first_aid_expiry: string | null
  fire_extinguisher_expiry: string | null
  taxi_licence_holder_id: number | null
  pmi_weeks: number | null
  last_pmi_date: string | null
  spare_vehicle: boolean | null
  off_the_road: boolean | null
  assigned_to: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VehicleWithRelations extends Vehicle {
  vehicle_updates?: VehicleUpdate[]
}

export interface Incident {
  id: number
  employee_id: number | null
  vehicle_id: number | null
  route_id: number | null
  incident_type: string | null
  description: string | null
  reported_at: string
  resolved: boolean
  updated_at: string
}

export interface IncidentWithRelations extends Incident {
  employees?: Employee | null
  vehicles?: Vehicle | null
  routes?: Route | null
  incident_employees?: IncidentEmployee[]
  incident_passengers?: IncidentPassenger[]
}

export interface IncidentEmployee {
  id: number
  incident_id: number
  employee_id: number
  created_at: string
  employees?: Employee
}

export interface IncidentPassenger {
  id: number
  incident_id: number
  passenger_id: number
  created_at: string
  passengers?: Passenger
}

export interface IncidentPartyEntry {
  id: number
  incident_id: number
  employee_id: number
  entry_text: string
  created_at: string
  updated_at: string
  employees?: { id: number; full_name: string; role: string }
}

export interface PassengerUpdate {
  id: number
  passenger_id: number
  update_text: string
  updated_by: number | null
  created_at: string
  updated_at: string
  users?: User | null
}

export interface VehicleUpdate {
  id: number
  vehicle_id: number
  update_text: string
  updated_by: number | null
  created_at: string
  updated_at: string
  users?: User | null
}

export interface PassengerWithRelations extends Passenger {
  schools?: School | null
  routes?: Route | null
  passenger_parent_contacts?: (PassengerParentContact & {
    parent_contacts?: ParentContact
  })[]
  passenger_updates?: PassengerUpdate[]
}

export interface ParentContactWithPassengers extends ParentContact {
  passenger_parent_contacts?: (PassengerParentContact & {
    passengers?: Passenger
  })[]
}

// Route Sessions and Attendance types
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type SessionType = 'AM' | 'PM'

export interface RouteSession {
  id: number
  route_id: number
  session_date: string
  session_type: SessionType
  driver_id: number | null
  passenger_assistant_id: number | null
  started_at: string | null
  ended_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RoutePassengerAttendance {
  id: number
  route_session_id: number
  passenger_id: number
  attendance_status: AttendanceStatus
  notes: string | null
  marked_by: number | null
  marked_at: string
  created_at: string
}

export interface RouteServiceHistory {
  route_id: number
  route_name: string | null
  session_id: number
  session_date: string
  session_type: SessionType
  driver_id: number | null
  driver_name: string | null
  passenger_assistant_id: number | null
  passenger_assistant_name: string | null
  started_at: string | null
  ended_at: string | null
  notes: string | null
  total_passengers: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  attendance_marked_count: number
  created_at: string
  updated_at: string
}

export interface RouteAttendanceSummary {
  route_session_id: number
  route_id: number
  route_name: string | null
  session_date: string
  session_type: SessionType
  total_attendance_records: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  total_passengers_on_route: number
  attendance_percentage: number | null
}

export interface PassengerAttendanceHistory {
  passenger_id: number
  passenger_name: string
  route_id: number
  route_name: string | null
  route_session_id: number
  session_date: string
  session_type: SessionType
  attendance_id: number
  attendance_status: AttendanceStatus
  attendance_notes: string | null
  marked_by: number | null
  marked_by_name: string | null
  marked_at: string
  created_at: string
}

// Vehicle Seating Plan types
export type SeatType = 'standard' | 'wheelchair' | 'exit_row'

export interface VehicleSeatingPlan {
  id: number
  vehicle_id: number
  name: string
  total_capacity: number
  rows: number
  seats_per_row: number
  wheelchair_spaces: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: number | null
  updated_by: number | null
}

export interface SeatingPlanSeat {
  id: number
  seating_plan_id: number
  seat_number: string
  seat_type: SeatType
  is_accessible: boolean
  notes: string | null
  created_at: string
}

export interface SeatingPlanInput {
  name: string
  total_capacity: number
  rows: number
  seats_per_row: number
  wheelchair_spaces: number
  notes?: string | null
}

export interface SubstitutionVehicle {
  vehicle_id: number
  registration_number: string
  make: string
  model: string
  seating_plan_name: string
  total_capacity: number
  rows: number
  seats_per_row: number
  wheelchair_spaces: number
  status: string
}

// Dashboard statistics types
export interface DashboardStats {
  employees: number
  vehicles: number
  schools: number
  routes: number
  passengers: number
  incidents: number
  passengersWithParentLinks: number
  recentPassengerUpdates: number
  latestUpdateTimestamp: string | null
  incidentsThisMonth: number
}

