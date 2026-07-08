import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AssetGroup } from '../types/asset'
import { groupRepository } from '../services/repositories'
import { v4 as uuidv4 } from 'uuid'

export const useGroupStore = defineStore('groups', () => {
  const groups = ref<AssetGroup[]>([])
  const activeGroupId = ref<string | null>(null)

  async function load(): Promise<void> {
    groups.value = await groupRepository.getAll()
  }

  async function create(name: string, icon: string): Promise<AssetGroup> {
    const maxOrder = groups.value.reduce((max, g) => Math.max(max, g.order), 0)
    const group: AssetGroup = {
      id: uuidv4(),
      name,
      icon,
      assetIds: [],
      order: maxOrder + 1,
      createdAt: Date.now(),
    }
    await groupRepository.create(group)
    groups.value.push(group)
    return group
  }

  async function rename(id: string, name: string): Promise<void> {
    await groupRepository.update(id, { name })
    const g = groups.value.find((g) => g.id === id)
    if (g) g.name = name
  }

  async function setIcon(id: string, icon: string): Promise<void> {
    await groupRepository.update(id, { icon })
    const g = groups.value.find((g) => g.id === id)
    if (g) g.icon = icon
  }

  async function remove(id: string): Promise<void> {
    await groupRepository.delete(id)
    groups.value = groups.value.filter((g) => g.id !== id)
    if (activeGroupId.value === id) activeGroupId.value = null
  }

  async function addAsset(groupId: string, assetId: string): Promise<void> {
    const g = groups.value.find((g) => g.id === groupId)
    if (!g || g.assetIds.includes(assetId)) return
    g.assetIds.push(assetId)
    await groupRepository.update(groupId, { assetIds: g.assetIds })
  }

  async function removeAsset(groupId: string, assetId: string): Promise<void> {
    const g = groups.value.find((g) => g.id === groupId)
    if (!g) return
    g.assetIds = g.assetIds.filter((id) => id !== assetId)
    await groupRepository.update(groupId, { assetIds: g.assetIds })
  }

  async function addAssets(groupId: string, assetIds: string[]): Promise<void> {
    const g = groups.value.find((g) => g.id === groupId)
    if (!g) return
    const newIds = assetIds.filter((id) => !g.assetIds.includes(id))
    if (newIds.length === 0) return
    g.assetIds.push(...newIds)
    await groupRepository.update(groupId, { assetIds: g.assetIds })
  }

  function setActiveGroup(id: string | null): void {
    activeGroupId.value = id
  }

  return {
    groups,
    activeGroupId,
    load,
    create,
    rename,
    setIcon,
    remove,
    addAsset,
    removeAsset,
    addAssets,
    setActiveGroup,
  }
})
