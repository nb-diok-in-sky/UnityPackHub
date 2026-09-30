<script setup lang="ts">
import type { Asset, AssetGroup, Tag } from "../../types/asset";
import { useI18n } from "../../i18n";
defineProps<{
  asset: Asset;
  groups: AssetGroup[];
  tags: Tag[];
  /** Name of the selected manual group containing this asset, if any. */
  activeGroupName: string | null;
}>();
const emit = defineEmits<{
  open: [];
  reveal: [];
  favorite: [];
  group: [id: string];
  tag: [id: string];
  removeFromGroup: [];
  remove: [];
}>();
const { t, tr } = useI18n();
</script>

<template>
  <q-menu context-menu>
    <q-list dense class="card-menu">
      <q-item clickable v-close-popup @click="emit('open')">
        <q-item-section side><q-icon name="download" size="16px" /></q-item-section>
        <q-item-section>{{ t.importToUnity }}</q-item-section>
      </q-item>
      <q-item clickable v-close-popup @click="emit('reveal')">
        <q-item-section side><q-icon name="folder_open" size="16px" /></q-item-section>
        <q-item-section>{{ t.openFileLocation }}</q-item-section>
      </q-item>

      <q-separator />
      <q-item clickable v-close-popup @click="emit('favorite')">
        <q-item-section side>
          <q-icon :name="asset.isFavorite ? 'star_border' : 'star'" size="16px" />
        </q-item-section>
        <q-item-section>{{ asset.isFavorite ? t.unfavorite : t.favorite }}</q-item-section>
      </q-item>
      <q-item v-if="tags.length" clickable>
        <q-item-section side><q-icon name="label" size="16px" /></q-item-section>
        <q-item-section>{{ t.tags }}</q-item-section>
        <q-item-section side><q-icon name="chevron_right" size="16px" /></q-item-section>
        <q-menu anchor="top end" self="top start">
          <q-list dense>
            <q-item v-for="tag in tags" :key="tag.id" clickable @click="emit('tag', tag.id)">
              <q-item-section side>
                <q-icon :name="asset.tagIds.includes(tag.id) ? 'check_box' : 'check_box_outline_blank'" size="16px" :style="{ color: tag.color }" />
              </q-item-section>
              <q-item-section>{{ tag.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-item>
      <q-item v-if="groups.length" clickable>
        <q-item-section side><q-icon name="create_new_folder" size="16px" /></q-item-section>
        <q-item-section>{{ t.addToGroup }}</q-item-section>
        <q-item-section side><q-icon name="chevron_right" size="16px" /></q-item-section>
        <q-menu anchor="top end" self="top start">
          <q-list dense>
            <q-item v-for="item in groups" :key="item.id" clickable v-close-popup @click="emit('group', item.id)">
              <q-item-section side><q-icon :name="item.icon" size="16px" /></q-item-section>
              <q-item-section>{{ item.name }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-item>
      <q-item v-if="activeGroupName" clickable v-close-popup @click="emit('removeFromGroup')">
        <q-item-section side><q-icon name="folder_off" size="16px" /></q-item-section>
        <q-item-section>{{ tr('removeFromNamedGroup', { group: activeGroupName }) }}</q-item-section>
      </q-item>

      <q-separator />
      <q-item clickable v-close-popup class="text-negative" @click="emit('remove')">
        <q-item-section side><q-icon name="delete_outline" size="16px" color="negative" /></q-item-section>
        <q-item-section>{{ t.removeFromLibrary }}</q-item-section>
      </q-item>
    </q-list>
  </q-menu>
</template>

<style scoped>
.card-menu {
  min-width: 180px;
}
</style>
