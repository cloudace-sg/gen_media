import React from "react"
import { useAuth } from "../../contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function ProtectedRoute({ children }) {
  const { user, loading, userRole } = useAuth()
  const isProd = process.env.NODE_ENV === 'production'

  if (loading || (isProd && user && userRole === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) return null
  if (isProd && !userRole) return null

  return <>{children}</>
}
