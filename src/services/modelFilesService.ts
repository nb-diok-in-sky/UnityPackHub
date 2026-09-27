// Files around a model on disk: sibling textures/materials and optional metadata tables.
import type { Asset } from '../types/asset'
import { normalizePath } from '../domain/paths'
import { backend, type AssetMetadata, type FileHashResult, type RelatedFile } from '../platform/backend'
import { fileExists } from '../platform/system'

const METADATA_FILES = ['asset_metadata.json', 'metadata.json', 'model_metadata.json']
const HASH_BATCH_SIZE = 100

export const modelFilesService = {
  relatedFiles: (modelPath: string): Promise<RelatedFile[]> => backend.scanModelRelatedFiles(modelPath),

  /** Metadata row for the model from the first metadata table found next to it. */
  async metadata(modelPath: string): Promise<AssetMetadata | null> {
    const separator = modelPath.includes('\\') ? '\\' : '/'
    const directory = modelPath.slice(0, normalizePath(modelPath).lastIndexOf('/'))
    for (const name of METADATA_FILES) {
      const candidate = `${directory}${separator}${name}`
      if (!(await fileExists(candidate))) continue
      const metadata = await backend.readAssetMetadata(candidate, modelPath)
      if (metadata) return metadata
    }
    return null
  },

  /** Asset id -> ids of other models with byte-identical content. */
  async findDuplicates(models: Asset[]): Promise<Record<string, string[]>> {
    const bySize = new Map<number, Asset[]>()
    for (const model of models) bySize.set(model.fileSize, [...(bySize.get(model.fileSize) ?? []), model])
    const candidates = [...bySize.values()].filter((group) => group.length > 1).flat()

    const hashes: FileHashResult[] = []
    for (let offset = 0; offset < candidates.length; offset += HASH_BATCH_SIZE) {
      hashes.push(...await backend.hashFiles(candidates.slice(offset, offset + HASH_BATCH_SIZE).map((model) => model.filePath)))
    }
    const byPath = new Map(candidates.map((model) => [model.filePath, model]))
    const byHash = new Map<string, Asset[]>()
    for (const { filePath, hash } of hashes) {
      const model = byPath.get(filePath)
      if (hash && model) byHash.set(hash, [...(byHash.get(hash) ?? []), model])
    }
    const duplicates: Record<string, string[]> = {}
    for (const group of byHash.values()) {
      if (group.length < 2) continue
      for (const model of group) duplicates[model.id] = group.filter((other) => other.id !== model.id).map((other) => other.id)
    }
    return duplicates
  },
}
