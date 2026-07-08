export type AppEvents = {
  'assets:refresh': void
  'scan:complete': { count: number }
  'scan:error': { message: string }
  'tag:created': { id: string }
  'tag:deleted': { id: string }
}
