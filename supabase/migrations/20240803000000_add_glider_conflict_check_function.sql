
-- Crear la función para verificar conflictos de horarios en vuelos de planeador
create
or replace function check_glider_conflict (
  p_date date,
  p_glider_id uuid,
  p_start_time time,
  p_end_time time,
  p_exclude_flight_id uuid default null
) returns boolean as $$
declare
  conflict_exists boolean;
begin
  select
    exists (
      select
        1
      from
        public.completed_glider_flights
      where
        date = p_date
        and glider_aircraft_id = p_glider_id
        and (
          id is null
          or id != p_exclude_flight_id
        )
        and tsrange(departure_time, arrival_time, '()') && tsrange(p_start_time, p_end_time, '()')
    ) into conflict_exists;
  return conflict_exists;
end;
$$ language plpgsql;
