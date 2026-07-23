<script setup lang="ts">
import type { AssetMetadata } from "../../services/tauriCommands";
import { useI18n } from "../../services/i18n";
defineProps<{ metadata: AssetMetadata }>();
const { t } = useI18n();
</script>
<template>
  <div class="panel">
    <div class="panel__title">
      {{ metadata.inferredObject || metadata.originalName }}
    </div>
    <div class="panel__grid">
      <span>{{ t.assetTypePrefab }}</span
      ><strong>{{ metadata.format || "-" }}</strong
      ><span>{{ t.filePath }}</span
      ><strong :title="metadata.path">{{ metadata.path }}</strong
      ><template v-if="metadata.sourceAsset"
        ><span>Source</span
        ><strong :title="metadata.sourceAsset">{{
          metadata.sourceAsset
        }}</strong></template
      ><template v-if="metadata.boundsText"
        ><span>Bounds</span><strong>{{ metadata.boundsText }}</strong></template
      >
    </div>
  </div>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.panel {
  padding: 10px;
  border: 1px solid $color-border;
  border-radius: 8px;
  background: var(--hover-overlay-subtle);
}
.panel__title {
  margin-bottom: 8px;
  color: $color-text;
  font-size: 13px;
  font-weight: 600;
}
.panel__grid {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 5px 10px;
  font-size: 11px;
}
.panel__grid span {
  color: $color-secondary;
}
.panel__grid strong {
  min-width: 0;
  overflow: hidden;
  color: $color-text;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
