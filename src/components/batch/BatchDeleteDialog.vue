<script setup lang="ts">
import { useI18n } from '../../services/i18n'

defineProps<{ count: number }>()
const model = defineModel<boolean>({ required: true })
const emit = defineEmits<{ confirm: [] }>()
const { t, tr } = useI18n()
</script>

<template>
  <q-dialog v-model="model">
    <q-card class="confirm-dialog">
      <q-card-section>
        <div class="text-h6">{{ t.deleteAssets }}</div>
      </q-card-section>
      <q-card-section>{{ tr('deleteConfirm', { count }) }}</q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup flat :label="t.cancel" color="grey" />
        <q-btn flat :label="t.delete" color="negative" @click="emit('confirm')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.confirm-dialog {
  border-radius: $radius-dialog;
  min-width: 360px;
}
</style>
