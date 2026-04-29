<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from 'primevue/button'

const router = useRouter()
const auth = useAuthStore()
const collapsed = ref(false)

const navItems = [{ label: 'Docker', icon: 'pi pi-box', to: '/docker' }]

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="layout" :class="{ collapsed }">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span v-if="!collapsed" class="sidebar-title">Admin</span>
        <Button
          :icon="collapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-left'"
          text
          rounded
          @click="collapsed = !collapsed"
        />
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="nav-item--active"
        >
          <i :class="item.icon" />
          <span v-if="!collapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <Button
          :label="collapsed ? undefined : 'Déconnexion'"
          icon="pi pi-sign-out"
          text
          severity="danger"
          fluid
          @click="logout"
        />
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  background: var(--p-surface-900);
  color: var(--p-surface-0);
}

.sidebar {
  display: flex;
  flex-direction: column;
  width: 220px;
  background: var(--p-surface-800);
  border-right: 1px solid var(--p-surface-700);
  transition: width 0.2s ease;
  overflow: hidden;
}

.layout.collapsed .sidebar {
  width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--p-surface-700);
}

.sidebar-title {
  font-weight: 600;
  font-size: 1.1rem;
  white-space: nowrap;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--p-surface-200);
  white-space: nowrap;
  transition: background 0.15s;
}

.nav-item:hover {
  background: var(--p-surface-700);
}

.nav-item--active {
  background: var(--p-primary-900);
  color: var(--p-primary-300);
}

.sidebar-footer {
  padding: 0.75rem 0.5rem;
  border-top: 1px solid var(--p-surface-700);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}
</style>
