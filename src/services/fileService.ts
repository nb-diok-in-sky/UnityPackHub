// File pickers and handing files or URLs to the operating system.
import { backend } from '../platform/backend'
import {
  onFileDrop,
  openExternal,
  pickDirectory,
  pickFile,
  pickSavePath,
  writeTextFileAt,
  type FileFilter,
} from '../platform/system'

export const JSON_FILTER: FileFilter = { name: 'JSON', extensions: ['json'] }

export const fileService = {
  pickDirectory,
  pickFile,
  pickSavePath,
  writeText: writeTextFileAt,
  openUrl: openExternal,
  reveal: (path: string): Promise<void> => backend.revealInExplorer(path),
  /** Files dragged onto the window from the OS file manager. */
  onFileDrop,
}
