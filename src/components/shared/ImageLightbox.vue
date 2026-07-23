<script setup lang="ts">
defineProps<{ src: string; title: string; subtitle?: string }>();
const open = defineModel<boolean>({ required: true });
</script>
<template>
  <Teleport to="body"
    ><Transition name="lightbox"
      ><div v-if="open" class="lightbox" @click.self="open = false">
        <div class="lightbox__content">
          <img :src="src" :alt="title" />
          <footer>
            <div>
              <strong>{{ title }}</strong
              ><small>{{ subtitle }}</small>
            </div>
            <div>
              <slot name="actions" /><q-btn
                flat
                dense
                round
                icon="close"
                color="grey-5"
                @click="open = false"
              />
            </div>
          </footer>
        </div></div></Transition
  ></Teleport>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
}
.lightbox__content {
  display: flex;
  max-width: 80vw;
  max-height: 85vh;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  background: $color-surface;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
}
.lightbox img {
  max-width: 80vw;
  max-height: 70vh;
  object-fit: contain;
  background: #1a1a1a;
}
.lightbox footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
}
.lightbox footer > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.lightbox footer > div:last-child {
  flex-direction: row;
  align-items: center;
}
.lightbox strong {
  color: $color-text;
  font-size: 14px;
}
.lightbox small {
  color: $color-secondary;
  font-size: 12px;
}
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
