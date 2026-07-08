import type { UserSettings } from '../../types/asset'

export interface ISettingsRepository {
  get(): Promise<UserSettings>
  save(settings: UserSettings): Promise<void>
}
