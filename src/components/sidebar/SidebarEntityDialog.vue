<script setup lang="ts">
import { computed } from "vue";
import type {
  EditableGroup,
  EditableTag,
} from "../../composables/useSidebarManagement";

const props = defineProps<{
  modelValue: EditableGroup | EditableTag | null;
  kind: "group" | "tag";
  title: string;
  fieldLabel: string;
  cancelLabel: string;
  saveLabel: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: EditableGroup | EditableTag | null];
  save: [value: EditableGroup | EditableTag];
}>();

const draft = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
const icons = [
  "folder",
  "inventory_2",
  "category",
  "widgets",
  "view_in_ar",
  "terrain",
  "brush",
  "auto_fix_high",
];
const colors = [
  "#007AFF",
  "#34C759",
  "#FF9500",
  "#FF3B30",
  "#AF52DE",
  "#FF2D55",
  "#5AC8FA",
  "#FFCC00",
];
</script>

<template>
  <q-dialog
    :model-value="draft !== null"
    @update:model-value="(open) => !open && (draft = null)"
  >
    <q-card v-if="draft" class="entity-dialog">
      <q-card-section
        ><div class="text-h6">{{ title }}</div></q-card-section
      >
      <q-card-section>
        <q-input
          v-if="kind === 'group' && 'name' in draft"
          v-model="draft.name"
          :label="fieldLabel"
          dense
          outlined
          autofocus
          @keyup.enter="$emit('save', draft)"
        />
        <q-input
          v-else-if="'label' in draft"
          v-model="draft.label"
          :label="fieldLabel"
          dense
          outlined
          autofocus
          @keyup.enter="$emit('save', draft)"
        />
        <div
          v-if="kind === 'group' && 'icon' in draft"
          class="option-grid q-mt-md"
        >
          <button
            v-for="icon in icons"
            :key="icon"
            class="icon-option"
            :class="{ 'icon-option--active': draft.icon === icon }"
            @click="draft.icon = icon"
          >
            <q-icon :name="icon" size="22px" />
          </button>
        </div>
        <div v-else-if="'color' in draft" class="option-grid q-mt-md">
          <button
            v-for="color in colors"
            :key="color"
            class="color-option"
            :class="{ 'color-option--active': draft.color === color }"
            :style="{ background: color }"
            @click="draft.color = color"
          />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="cancelLabel" color="grey" @click="draft = null" />
        <q-btn
          flat
          :label="saveLabel"
          color="primary"
          @click="$emit('save', draft)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.entity-dialog {
  border-radius: $radius-dialog;
  min-width: 320px;
}
.option-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.icon-option {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: var(--hover-overlay);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-secondary;
  transition: $transition-fast;
  &:hover,
  &--active {
    color: $apple-blue;
  }
  &--active {
    border-color: $apple-blue;
    background: var(--accent-soft);
  }
}
.color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: $transition-fast;
  &:hover {
    transform: scale(1.1);
  }
  &--active {
    border-color: $color-text;
    transform: scale(1.15);
  }
}
</style>
