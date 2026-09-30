<script setup lang="ts">
import { useBackup } from '../../composables/useBackup'
import { useI18n } from '../../i18n'

const backup = useBackup()
const { t } = useI18n()
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.dataBackup }}</div>
  <div class="text-caption text-grey-7 q-mb-sm">{{ t.dataBackupHint }}</div>
  <div class="row q-gutter-sm">
    <q-btn
      outline
      dense
      no-caps
      icon="save_alt"
      color="primary"
      :label="t.exportBackup"
      :loading="backup.busy.value"
      @click="backup.exportBackup"
    />
    <q-btn
      outline
      dense
      no-caps
      icon="settings_backup_restore"
      color="grey-8"
      :label="t.restoreBackup"
      :disable="backup.busy.value"
      @click="backup.restoreBackup"
    />
  </div>
</template>
