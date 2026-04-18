'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { User } from '@/lib/types'

export function useProfile() {
  return useQuery<User>({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/v1/user/profile').then((r) => r.data),
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/api/v1/auth/login', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      username: string
      email: string
      password: string
    }) => api.post('/api/v1/auth/register', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/api/v1/auth/logout').then((r) => r.data),
    onSuccess: () => {
      qc.clear()
      window.location.href = '/login'
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      username?: string
      email?: string
    }) => api.put('/api/v1/user/profile', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
