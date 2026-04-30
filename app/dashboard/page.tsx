import {  createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage(){
    const supabase = await createClient()
    const {data: { user } } = await supabase.auth.getUser()

    if (!user){
        redirect('/login')
    }

    return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to Aurum</h1>
        <p className="text-sm text-gray-500">Logged in as {user.email}</p>
      </div>
    </div>
  )
}
