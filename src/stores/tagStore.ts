import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Tag } from '../types/asset'
import { tagRecords } from '../services/organizationService'
import { useSettingsStore } from './settingsStore'

/** Render-pipeline tags created once on first launch; users may rename or delete them. */
const PIPELINE_TAGS: Tag[] = [
  { id: 'system-pipeline-built-in', label: 'Built-in', color: '#34C759' },
  { id: 'system-pipeline-urp', label: 'URP', color: '#007AFF' },
  { id: 'system-pipeline-hdrp', label: 'HDRP', color: '#AF52DE' },
]

export const useTagStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])
  const tagMap = computed(() => new Map(tags.value.map((tag) => [tag.id, tag])))

  function sort(): void {
    tags.value.sort((left, right) => left.label.localeCompare(right.label))
  }

  async function load(): Promise<void> {
    tags.value = await tagRecords.getAll()
    const settings = useSettingsStore()
    if (!settings.settings.defaultPipelineTagsInitialized) {
      for (const tag of PIPELINE_TAGS) {
        const exists = tags.value.some(
          (current) => current.id === tag.id || current.label.toLowerCase() === tag.label.toLowerCase(),
        )
        if (exists) continue
        await tagRecords.save(tag)
        tags.value.push({ ...tag })
      }
      await settings.update((draft) => {
        draft.defaultPipelineTagsInitialized = true
      })
    }
    sort()
  }

  async function create(label: string, color: string): Promise<Tag> {
    const tag: Tag = { id: uuid(), label, color }
    await tagRecords.save(tag)
    tags.value.push(tag)
    sort()
    return tag
  }

  async function update(id: string, patch: Pick<Tag, 'label' | 'color'>): Promise<void> {
    const current = tagMap.value.get(id)
    if (!current) return
    const next = { ...current, ...patch }
    await tagRecords.save(next)
    tags.value = tags.value.map((tag) => (tag.id === id ? next : tag))
    sort()
  }

  /** Deletes the tag everywhere; the caller reloads assets afterwards. */
  async function remove(id: string): Promise<void> {
    await tagRecords.delete(id)
    tags.value = tags.value.filter((tag) => tag.id !== id)
  }

  return { tags, tagMap, load, create, update, remove, getTagById: (id: string) => tagMap.value.get(id) }
})
