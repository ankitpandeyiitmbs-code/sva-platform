'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { api, setAuthTokens } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'

const schema = z.object({
  orgName: z.string().min(2, 'Company name required'),
  orgSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, hyphens'),
  name: z.string().min(2, 'Your name required'),
  email: z.string().email(),
  password: z.string().min(8),
  timezone: z.string().default('UTC'),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { orgName: 'SVA Organics', orgSlug: 'sva-organics', timezone: 'Asia/Kolkata' },
  })

  const orgName = form.watch('orgName')
  const suggestSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

  const onSubmit = async (values: FormData) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { ...values, currencies: ['USD', 'INR', 'AED', 'GBP', 'AUD'] })
      const { tokens, user } = data.data
      setAuthTokens(tokens.accessToken, tokens.refreshToken)
      setUser(user)
      toast.success('Workspace created! Welcome to SVA Platform.')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold">SVA Platform</span>
          </div>
          <h1 className="text-3xl font-bold">Create your workspace</h1>
          <p className="mt-2 text-muted-foreground">Set up your business operating platform in minutes</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company Name</label>
              <input
                {...form.register('orgName')}
                onBlur={(e) => { if (!form.getValues('orgSlug')) form.setValue('orgSlug', suggestSlug(e.target.value)) }}
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              {form.formState.errors.orgName && <p className="text-xs text-destructive">{form.formState.errors.orgName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Workspace ID <span className="text-muted-foreground">(URL slug)</span></label>
              <input
                {...form.register('orgSlug')}
                placeholder="sva-organics"
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              {form.formState.errors.orgSlug && <p className="text-xs text-destructive">{form.formState.errors.orgSlug.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Your Name</label>
            <input {...form.register('name')} className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input {...form.register('email')} type="email" className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input {...form.register('password')} type="password" className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Workspace
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have a workspace?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
