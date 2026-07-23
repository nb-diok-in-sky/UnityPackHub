import { computed, ref } from "vue";
import type { AssetGroup, AssetKind, Tag } from "../types/asset";
import { useAssetStore } from "../stores/assetStore";
import { useGroupStore } from "../stores/groupStore";
import { useTagStore } from "../stores/tagStore";

export interface EditableTag {
  id?: string;
  label: string;
  color: string;
}

export interface EditableGroup {
  id?: string;
  name: string;
  icon: string;
}

export function useSidebarManagement() {
  const assetStore = useAssetStore();
  const tagStore = useTagStore();
  const groupStore = useGroupStore();
  const tagDraft = ref<EditableTag | null>(null);
  const groupDraft = ref<EditableGroup | null>(null);

  const visibleGroups = computed(() =>
    groupStore.groups.filter(
      (group) =>
        group.source !== "classification" &&
        (group.assetKind === undefined ||
          group.assetKind === assetStore.activeAssetKind),
    ),
  );

  function selectAssetKind(kind: AssetKind): void {
    assetStore.setActiveAssetKind(kind);
  }

  function selectFavorites(): void {
    tagStore.setActiveTag(null);
    groupStore.setActiveGroup(null);
    assetStore.setFavoritesOnly(true);
  }

  function selectTag(id: string): void {
    assetStore.setFavoritesOnly(false);
    groupStore.setActiveGroup(null);
    tagStore.setActiveTag(tagStore.activeTagId === id ? null : id);
  }

  function selectGroup(id: string): void {
    assetStore.setFavoritesOnly(false);
    tagStore.setActiveTag(null);
    groupStore.setActiveGroup(groupStore.activeGroupId === id ? null : id);
  }

  function createTag(): void {
    tagDraft.value = { label: "", color: "#007AFF" };
  }

  function editTag(tag: Tag): void {
    tagDraft.value = { id: tag.id, label: tag.label, color: tag.color };
  }

  async function saveTag(draft: EditableTag): Promise<void> {
    const label = draft.label.trim();
    if (!label) return;
    if (draft.id)
      await tagStore.update(draft.id, { label, color: draft.color });
    else await tagStore.create(label, draft.color);
    tagDraft.value = null;
  }

  function createGroup(): void {
    groupDraft.value = { name: "", icon: "folder" };
  }

  function editGroup(group: AssetGroup): void {
    groupDraft.value = { id: group.id, name: group.name, icon: group.icon };
  }

  async function saveGroup(draft: EditableGroup): Promise<void> {
    const name = draft.name.trim();
    if (!name) return;
    if (draft.id) {
      await groupStore.rename(draft.id, name);
      await groupStore.setIcon(draft.id, draft.icon);
    } else {
      await groupStore.create(name, draft.icon, assetStore.activeAssetKind);
    }
    groupDraft.value = null;
  }

  return {
    assetStore,
    tagStore,
    groupStore,
    visibleGroups,
    tagDraft,
    groupDraft,
    selectAssetKind,
    selectFavorites,
    selectTag,
    selectGroup,
    createTag,
    editTag,
    saveTag,
    deleteTag: tagStore.remove,
    createGroup,
    editGroup,
    saveGroup,
    deleteGroup: groupStore.remove,
  };
}
