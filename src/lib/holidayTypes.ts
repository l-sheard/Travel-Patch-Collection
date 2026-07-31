export const HOLIDAY_TYPES = [
  'Beach',
  'City',
  'Mountains',
  'Skiing',
  'Hiking',
  'Activity',
  'Culture',
  'Road Trip',
  'Wildlife',
  'Relaxation',
  'Cruise',
  'Food & Wine',
] as const

export type HolidayType = (typeof HOLIDAY_TYPES)[number]
