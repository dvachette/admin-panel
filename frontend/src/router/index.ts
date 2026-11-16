import { createRouter, createWebHistory } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/docker',
        },
        {
          path: 'docker',
          name: 'docker',
          component: () => import('@/views/DockerView.vue'),
        },
        {
          path: 'nginx',
          name: 'nginx',
          component: () => import('@/views/NginxView.vue'),
        },
        {
          path: 'portfolio',
          name: 'portfolio',
          component: () => import('@/views/PortfolioView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.checkSession()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return '/'
  }
})

// Session expired (JWT is valid 24h): go back to the login page
axios.interceptors.response.use(undefined, (error) => {
  const url: string = error.config?.url ?? ''
  if (axios.isAxiosError(error) && error.response?.status === 401 && !url.startsWith('/api/auth/')) {
    useAuthStore().clearSession()
    router.push({ name: 'login' })
  }
  return Promise.reject(error)
})

export default router
