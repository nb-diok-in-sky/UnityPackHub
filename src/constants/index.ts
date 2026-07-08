import type { TranslationKey } from '../services/i18n'

export const ASSET_TYPE_ICONS: Record<string, string> = {
  Model: 'view_in_ar',
  Texture: 'image',
  Material: 'palette',
  Shader: 'code',
  Prefab: 'widgets',
  Script: 'description',
  Scene: 'landscape',
  Animation: 'animation',
  Audio: 'music_note',
  Font: 'font_download',
  Asset: 'inventory_2',
  Plugin: 'extension',
  UI: 'dashboard',
  Other: 'insert_drive_file',
}

export const TYPE_I18N_MAP: Record<string, TranslationKey> = {
  All: 'assetTypeAll',
  Model: 'assetTypeModel',
  Material: 'assetTypeMaterial',
  Texture: 'assetTypeTexture',
  Shader: 'assetTypeShader',
  Prefab: 'assetTypePrefab',
  Script: 'assetTypeScript',
  Scene: 'assetTypeScene',
  Animation: 'assetTypeAnimation',
  Audio: 'assetTypeAudio',
  Font: 'assetTypeFont',
  Asset: 'assetTypeAsset',
  Plugin: 'assetTypePlugin',
  UI: 'assetTypeUI',
  Other: 'assetTypeOther',
}
