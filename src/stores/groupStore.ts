import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { AssetGroup, AssetKind } from '../types/asset'
import { groupRecords } from '../services/organizationService'

export const useGroupStore = defineStore('groups', () => {
  const groups = ref<AssetGroup[]>([])

  const manualGroups = computed(() => groups.value.filter((group) => group.source !== 'classification'))
  const classificationGroups = computed(() => groups.value.filter((group) => group.source === 'classification'))

  async function load(): Promise<void> {
    groups.value = await groupRecords.getAll()
  }

  async function save(group: AssetGroup): Promise<void> {
    await groupRecords.save(group)
    const index = groups.value.findIndex((current) => current.id === group.id)
    if (index === -1) groups.value.push(group)
    else groups.value[index] = group
  }

  async function create(name: string, icon: string, assetKind?: AssetKind): Promise<AssetGroup> {
    const order = groups.value.reduce((max, group) => Math.max(max, group.order), 0) + 1
    const group: AssetGroup = {
      id: uuid(),
      name,
      icon,
      assetIds: [],
      order,
      createdAt: Date.now(),
      source: 'manual',
      ...(assetKind ? { assetKind } : {}),
    }
    await save(group)
    return group
  }

  async function edit(id: string, patch: Pick<AssetGroup, 'name' | 'icon'>): Promise<void> {
    const group = groups.value.find((current) => current.id === id)
    if (group) await save({ ...group, ...patch })
  }

  async function remove(id: string): Promise<void> {
    await groupRecords.delete(id)
    groups.value = groups.value.filter((group) => group.id !== id)
  }

  async function addAssets(groupId: string, assetIds: string[]): Promise<void> {
    const group = groups.value.find((current) => current.id === groupId)
    if (!group) return
    const added = assetIds.filter((id) => !group.assetIds.includes(id))
    if (added.length > 0) await save({ ...group, assetIds: [...group.assetIds, ...added] })
  }

  async function removeAssets(groupId: string, assetIds: string[]): Promise<void> {
    const group = groups.value.find((current) => current.id === groupId)
    if (!group) return
    const removed = new Set(assetIds)
    const remaining = group.assetIds.filter((id) => !removed.has(id))
    if (remaining.length !== group.assetIds.length) await save({ ...group, assetIds: remaining })
  }

  return { groups, manualGroups, classificationGroups, load, create, edit, remove, addAssets, removeAssets }
})
