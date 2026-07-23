<script setup lang="ts">
import type { Asset, AssetGroup } from "../../types/asset";
import { useI18n } from "../../services/i18n";
defineProps<{ asset: Asset; groups: AssetGroup[] }>();
const emit = defineEmits<{
  open: [];
  reveal: [];
  favorite: [];
  group: [id: string];
}>();
const { t } = useI18n();
</script>
<template>
  <q-menu context-menu
    ><q-list dense
      ><q-item clickable v-close-popup @click="emit('open')"
        ><q-item-section side
          ><q-icon name="download" size="16px" /></q-item-section
        ><q-item-section>{{ t.importToUnity }}</q-item-section></q-item
      ><q-item clickable v-close-popup @click="emit('reveal')"
        ><q-item-section side
          ><q-icon name="folder_open" size="16px" /></q-item-section
        ><q-item-section>{{ t.openFileLocation }}</q-item-section></q-item
      ><q-separator /><q-item clickable v-close-popup @click="emit('favorite')"
        ><q-item-section side
          ><q-icon
            :name="asset.isFavorite ? 'star_border' : 'star'"
            size="16px" /></q-item-section
        ><q-item-section>{{
          asset.isFavorite ? t.unfavorite : t.favorite
        }}</q-item-section></q-item
      ><template v-if="groups.length"
        ><q-separator /><q-item clickable
          ><q-item-section side
            ><q-icon name="create_new_folder" size="16px" /></q-item-section
          ><q-item-section>{{ t.addToGroup }}</q-item-section
          ><q-item-section side
            ><q-icon name="chevron_right" size="16px" /></q-item-section
          ><q-menu anchor="top end" self="top start"
            ><q-list dense
              ><q-item
                v-for="item in groups"
                :key="item.id"
                clickable
                v-close-popup
                @click="emit('group', item.id)"
                ><q-item-section side
                  ><q-icon :name="item.icon" size="16px" /></q-item-section
                ><q-item-section>{{ item.name }}</q-item-section></q-item
              ></q-list
            ></q-menu
          ></q-item
        ></template
      ></q-list
    ></q-menu
  >
</template>
