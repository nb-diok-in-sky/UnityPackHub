<script setup lang="ts">
import { useI18n } from "../../services/i18n";
defineProps<{ max: number; missing: number; currentView: number }>();
const open = defineModel<boolean>("open", { required: true });
const limit = defineModel<number>("limit", { required: true });
const currentViewOnly = defineModel<boolean>("currentViewOnly", {
  required: true,
});
const emit = defineEmits<{ start: [] }>();
const { t } = useI18n();
</script>
<template>
  <q-dialog v-model="open"
    ><q-card class="dialog"
      ><q-card-section
        ><div class="text-h6">{{ t.modelCoverBatchTitle }}</div>
        <div class="text-caption text-grey-7">
          {{ t.modelCoverMissing }}: {{ missing }}
        </div>
        <div class="text-caption text-grey-7">
          {{ t.modelCoverCurrentView }}: {{ currentView }}
        </div></q-card-section
      ><q-card-section
        ><q-toggle
          v-model="currentViewOnly"
          :label="t.modelCoverUseCurrentView"
          class="q-mb-md" />
        <div class="dialog__value">{{ limit }}</div>
        <q-slider
          v-model="limit"
          :min="1"
          :max="Math.max(1, max)"
          :step="1"
          label
          color="primary" /><q-input
          v-model.number="limit"
          type="number"
          dense
          outlined
          :min="1"
          :max="Math.max(1, max)"
          :label="t.modelCoverBatchCount" /></q-card-section
      ><q-card-actions align="right"
        ><q-btn flat :label="t.cancel" color="grey" v-close-popup /><q-btn
          unelevated
          :label="t.startGeneration"
          color="primary"
          v-close-popup
          @click="emit('start')" /></q-card-actions></q-card
  ></q-dialog>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.dialog {
  width: 420px;
  border-radius: $radius-dialog;
}
.dialog__value {
  margin-bottom: 4px;
  color: $apple-blue;
  font-size: 28px;
  font-weight: 700;
  text-align: center;
}
</style>
