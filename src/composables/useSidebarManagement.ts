import { computed, ref } from 'vue'
import type { AssetGroup, Tag } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useGroupStore } from '../stores/groupStore'
import { useTagStore } from '../stores/tagStore'

export interface EditableTag {
  id?: string
  label: string
  color: string
}
export interface EditableGroup {
  id?: string
  name: string
  icon: string
}

/** Sidebar navigation plus the create/edit dialogs for tags and groups. */
export function useSidebarManagement() {
  const assets = useAssetStore()
  const browse = useBrowseStore()
  const tags = useTagStore()
  const groups = useGroupStore()
  const tagDraft = ref<EditableTag | null>(null)
  const groupDraft = ref<EditableGroup | null>(null)

  const visibleGroups = computed(() =>
    groups.manualGroups.filter((group) => group.assetKind === undefined || group.assetKind === browse.kind),
  )

  async function saveTag(draft: EditableTag): Promise<void> {
    const label = draft.label.trim()
    if (!label) return
    if (draft.id) await tags.update(draft.id, { label, color: draft.color })
    else await tags.create(label, draft.color)
    tagDraft.value = null
  }

  async function deleteTag(id: string): Promise<void> {
    if (browse.activeTagId === id) browse.showAll()
    if (browse.paintingTagId === id) browse.stopPainting()
    await tags.remove(id)
    await assets.load()
  }

  async function saveGroup(draft: EditableGroup): Promise<void> {
    const name = draft.name.trim()
    if (!name) return
    if (draft.id) await groups.edit(draft.id, { name, icon: draft.icon })
    else await groups.create(name, draft.icon, browse.kind)
    groupDraft.value = null
  }

  async function deleteGroup(id: string): Promise<void> {
    if (browse.activeGroupId === id) browse.showAll()
    await groups.remove(id)
  }

  return {
    assets,
    browse,
    tags,
    groups,
    visibleGroups,
    tagDraft,
    groupDraft,
    createTag: () => {
      tagDraft.value = { label: '', color: '#007AFF' }
    },
    editTag: (tag: Tag) => {
      tagDraft.value = { id: tag.id, label: tag.label, color: tag.color }
    },
    saveTag,
    deleteTag,
    createGroup: () => {
      groupDraft.value = { name: '', icon: 'folder' }
    },
    editGroup: (group: AssetGroup) => {
      groupDraft.value = { id: group.id, name: group.name, icon: group.icon }
    },
    saveGroup,
    deleteGroup,
  }
}
