import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  // Whether the session cookie has been checked against the backend since page load
  const checked = ref(false)

  async function login(username: string, password: string) {
    await axios.post('/api/auth/login', { username, password }, { withCredentials: true })
    isAuthenticated.value = true
    checked.value = true
  }

  /** Restores the session from the (httpOnly) cookie, once per page load. */
  async function checkSession() {
    if (checked.value) return
    try {
      await axios.get('/api/auth/me', { withCredentials: true })
      isAuthenticated.value = true
    } catch {
      isAuthenticated.value = false
    } finally {
      checked.value = true
    }
  }

  async function logout() {
    isAuthenticated.value = false
    try {
      await axios.post('/api/auth/logout', null, { withCredentials: true })
    } catch {
      // The cookie expires with the browser session anyway
    }
  }

  /** Called when the backend rejects the session (expired JWT). */
  function clearSession() {
    isAuthenticated.value = false
  }

  return { isAuthenticated, login, logout, checkSession, clearSession }
})
