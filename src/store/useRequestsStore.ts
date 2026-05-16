import { create } from 'zustand'
import {
  fetchPendingRequests,
  fetchPendingRequestsCount,
  acceptRequest,
  rejectRequest,
} from '../services/requestsService'
import type { JoinRequest } from '../services/requestsService'

interface RequestsState {
  requests: JoinRequest[]
  count:    number
  loading:  boolean
  fetchCount: () => Promise<void>
  fetchAll:   () => Promise<void>
  accept:     (request: JoinRequest) => Promise<void>
  reject:     (request: JoinRequest) => Promise<void>
}

export const useRequestsStore = create<RequestsState>()((set, get) => ({
  requests: [],
  count:    0,
  loading:  false,

  fetchCount: async () => {
    try {
      const count = await fetchPendingRequestsCount()
      set({ count })
    } catch (err) {
      console.error('[requests] fetchCount error:', err)
    }
  },

  fetchAll: async () => {
    set({ loading: true })
    try {
      const requests = await fetchPendingRequests()
      set({ requests, count: requests.length })
    } catch (err) {
      console.error('[requests] fetchAll error:', err)
    } finally {
      set({ loading: false })
    }
  },

  accept: async (request) => {
    await acceptRequest(request)
    const requests = get().requests.filter(r => r.id !== request.id)
    set({ requests, count: requests.length })
  },

  reject: async (request) => {
    await rejectRequest(request)
    const requests = get().requests.filter(r => r.id !== request.id)
    set({ requests, count: requests.length })
  },
}))
