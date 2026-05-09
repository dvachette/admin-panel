<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push('/')
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Identifiants invalides',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <h2>Admin Panel</h2>
      <div class="field">
        <InputText v-model="username" placeholder="Utilisateur" fluid @keydown.enter="handleLogin"/>
      </div>
      <div class="field">
        <Password v-model="password" placeholder="Mot de passe" :feedback="false" fluid @keydown.enter="handleLogin"/>
      </div>
      <Button label="Connexion" :loading="loading" fluid @click="handleLogin" />
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--p-surface-900);
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 360px;
  padding: 2rem;
  background: var(--p-surface-800);
  border-radius: 12px;
}

h2 {
  margin: 0 0 0.5rem;
  text-align: center;
  color: var(--p-surface-0);
}
</style>
