import React from "react"
import { useAuth } from "../../contexts/auth-context"
import { LogOut, User } from "lucide-react"

export default function UserProfile() {
  const { user, signOut } = useAuth()

  if (!user) return null

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.displayName || "User"} 
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <User className="h-4 w-4 text-gray-600" />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">
          {user.displayName || user.email}
        </span>
        <span className="text-xs text-gray-500">{user.email}</span>
      </div>
      <button
        onClick={handleSignOut}
        className="text-gray-500 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}
