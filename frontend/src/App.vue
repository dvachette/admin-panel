<script setup lang="ts">
import { onMounted } from 'vue'
import Toast from 'primevue/toast'

onMounted(() => {
  document.documentElement.classList.add('dark')
})
</script>

<template>
  <Toast />
  <RouterView />
</template>
