-- TAS5 export: one row per route for a school (used by API route)
create or replace function public.export_tas5_rows(p_school_id int)
returns table (
  school_fps text,
  school_name text,

  route_id int,
  route_number text,

  vehicle_id int,
  vehicle_registration text,
  vehicle_type text,
  operating_type text,
  plate_number text,
  plate_expiry_date date,
  licensed_capacity int,
  make text,
  model text,

  driver_name text,
  driver_tas text,
  driver_tas_expiry date,

  pa_name text,
  pa_tas text,
  pa_tas_expiry date
)
language sql
stable
as $$
  select
    s.ref_number::text as school_fps,
    s.name::text as school_name,

    r.id as route_id,
    r.route_number::text as route_number,

    v.id as vehicle_id,
    v.registration::text as vehicle_registration,
    v.vehicle_type::text as vehicle_type,
    v.operating_type::text as operating_type,
    v.plate_number::text as plate_number,
    v.plate_expiry_date as plate_expiry_date,
    vsp.total_capacity as licensed_capacity,
    v.make::text as make,
    v.model::text as model,

    ed.full_name::text as driver_name,
    d.tas_badge_number::text as driver_tas,
    d.tas_badge_expiry_date as driver_tas_expiry,

    epa.full_name::text as pa_name,
    pa.tas_badge_number::text as pa_tas,
    pa.tas_badge_expiry_date as pa_tas_expiry

  from public.routes r
  join public.schools s on s.id = r.school_id
  left join public.vehicles v on v.id = r.vehicle_id

  left join lateral (
    select vsp2.total_capacity
    from public.vehicle_seating_plans vsp2
    where vsp2.vehicle_id = v.id
      and vsp2.is_active = true
    order by vsp2.updated_at desc nulls last
    limit 1
  ) vsp on true

  left join public.drivers d on d.employee_id = r.driver_id
  left join public.employees ed on ed.id = d.employee_id

  left join public.passenger_assistants pa on pa.employee_id = r.passenger_assistant_id
  left join public.employees epa on epa.id = pa.employee_id

  where s.id = p_school_id
  order by r.id;
$$;
