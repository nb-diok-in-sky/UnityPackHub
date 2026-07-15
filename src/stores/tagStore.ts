import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tag } from '../types/asset'
import { settingsRepository, tagRepository } from '../services/repositories'
import { v4 as uuidv4 } from 'uuid'
import { eventBus } from '../services/eventBus'

const SYSTEM_TAGS: Tag[] = [
  { id: 'system-pipeline-built-in', label: 'Built-in', color: '#34C759' },
  { id: 'system-pipeline-urp', label: 'URP', color: '#007AFF' },
  { id: 'system-pipeline-hdrp', label: 'HDRP', color: '#AF52DE' },
]

export const useTagStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])
  const activeTagId = ref<string | null>(null)

  const activeTag = computed(() =>
    tags.value.find((t) => t.id === activeTagId.value) ?? null
  )

  const tagMap = computed(() => {
    const map = new Map<string, Tag>()
    for (const tag of tags.value) {
      map.set(tag.id, tag)
    }
    return map
  })

  async function load(): Promise<void> {
    tags.value = await tagRepository.getAll()
    const settings = await settingsRepository.get()
    if (!settings.defaultPipelineTagsInitialized) {
      for (const defaultTag of SYSTEM_TAGS) {
        const existing = tags.value.find((tag) => tag.id === defaultTag.id)
          ?? tags.value.find((tag) => tag.label.toLowerCase() === defaultTag.label.toLowerCase())
        if (existing) {
          if (existing.isSystem) {
            await tagRepository.update(existing.id, { isSystem: false })
            existing.isSystem = false
          }
          continue
        }
        await tagRepository.create(defaultTag)
        tags.value.push(defaultTag)
      }
      settings.defaultPipelineTagsInitialized = true
      await settingsRepository.save(settings)
    }
    tags.value.sort((a, b) => a.label.localeCompare(b.label))
  }

  async function create(label: string, color: string): Promise<Tag> {
    const tag: Tag = { id: uuidv4(), label, color }
    await tagRepository.create(tag)
    tags.value.push(tag)
    eventBus.emit('tag:created', { id: tag.id })
    return tag
  }

  async function update(id: string, data: Partial<Tag>): Promise<void> {
    await tagRepository.update(id, data)
    const index = tags.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      tags.value[index] = Object.assign({}, tags.value[index], data)
    }
  }

  async function remove(id: string): Promise<void> {
    await tagRepository.delete(id)
    tags.value = tags.value.filter((t) => t.id !== id)
    if (activeTagId.value === id) {
      activeTagId.value = null
    }
    eventBus.emit('tag:deleted', { id })
  }

  function setActiveTag(id: string | null): void {
    activeTagId.value = id
  }

  function getTagById(id: string): Tag | undefined {
    return tagMap.value.get(id)
  }

  return {
    tags,
    activeTagId,
    activeTag,
    tagMap,
    load,
    create,
    update,
    remove,
    setActiveTag,
    getTagById,
  }
})
