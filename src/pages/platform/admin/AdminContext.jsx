import { createContext, useContext } from 'react'

const AdminContext = createContext(null)

export function AdminContextProvider({ value, children }) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdminContext() {
  return useContext(AdminContext)
}
