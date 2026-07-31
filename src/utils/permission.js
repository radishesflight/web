import { useUserStore } from '@/stores/user'

export function hasPermission(code) {
  const userStore = useUserStore()
  return userStore.hasPermission(code)
}

export function hasAnyPermission(codes) {
  const userStore = useUserStore()
  return codes.some(code => userStore.permissions.includes(code))
}
