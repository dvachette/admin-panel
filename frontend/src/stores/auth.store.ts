import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)

  async function login(username: string, password: string) {
    await axios.post('/api/auth/login', { username, password }, { withCredentials: true })
    isAuthenticated.value = true
  }

  function logout() {
    isAuthenticated.value = false
  }

  return { isAuthenticated, login, logout }
})
