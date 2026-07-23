<script setup lang="ts">
import { useTagStore } from '../../stores/tagStore'
import { useI18n } from '../../services/i18n'

const emit = defineEmits<{
  add: [tagId: string]
  remove: [tagId: string]
}>()

const tagStore = useTagStore()
const { t } = useI18n()
</script>

<template>
  <q-menu>
    <q-list dense>
      <q-item-label header>{{ t.addTag }}</q-item-label>
      <q-item
        v-for="tag in tagStore.tags"
        :key="tag.id"
        v-close-popup
        clickable
        @click="emit('add', tag.id)"
      >
        <q-item-section side>
          <span class="tag-dot" :style="{ background: tag.color }" />
        </q-item-section>
        <q-item-section>{{ tag.label }}</q-item-section>
      </q-item>

      <template v-if="tagStore.tags.length > 0">
        <q-separator />
        <q-item-label header>{{ t.removeTag }}</q-item-label>
        <q-item
          v-for="tag in tagStore.tags"
          :key="`remove-${tag.id}`"
          v-close-popup
          clickable
          @click="emit('remove', tag.id)"
        >
          <q-item-section side>
            <q-icon name="remove_circle_outline" size="14px" color="negative" />
          </q-item-section>
          <q-item-section>{{ tag.label }}</q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-menu>
</template>

<style scoped>
.tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
</style>
