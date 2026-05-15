'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgSlug: z.string().min(1, 'Organization ID is required'),
})
type FormData = z.infer<typeof schema>

const twoFASchema = z.object({ code: z.string().length(6, '6-digit code required') })
type TwoFAData = z.infer<typeof twoFASchema>

export default function LoginPage() {
  const router = useRouter()
  const { login, verifyTwoFactor, isLoading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [twoFAState, setTwoFAState] = useState<{ required: boolean; userId?: string }>({ required: false })

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { orgSlug: 'sva-organics' } })
  const twoFAForm = useForm<TwoFAData>({ resolver: zodResolver(twoFASchema) })

  const onSubmit = async (values: FormData) => {
    try {
      const result = await login(values.email, values.password, values.orgSlug)
      if (result.requiresTwoFactor) {
        setTwoFAState({ required: true, userId: result.userId })
        return
      }
      toast.success('Welcome back!')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Login failed')
    }
  }

  const onTwoFA = async (values: TwoFAData) => {
    try {
      await verifyTwoFactor(twoFAState.userId!, values.code)
      toast.success('Welcome back!')
      router.push('/dashboard')
    } catch {
      toast.error('Invalid code')
    }
  }

  if (twoFAState.required) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
          </div>
          <form onSubmit={twoFAForm.handleSubmit(onTwoFA)} className="space-y-4">
            <input
              {...twoFAForm.register('code')}
              placeholder="000000"
              maxLength={6}
              className="w-full rounded-lg border bg-background px-4 py-3 text-center text-2xl tracking-widest outline-none ring-offset-background focus:ring-2 focus:ring-primary"
            />
            {twoFAForm.formState.errors.code && <p className="text-sm text-destructive">{twoFAForm.formState.errors.code.message}</p>}
            <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />} Verify
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold text-white">SVA Platform</span>
          </div>
        </div>
        <div className="space-y-4">
          <blockquote className="text-2xl font-medium leading-relaxed text-white">
            "One platform to run your entire business — from orders to finance to customer support."
          </blockquote>
          <p className="text-sidebar-foreground/70">SVA Organics — Essential Oils &amp; Carrier Oils</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[['10+', 'Modules'], ['50+', 'Team Members'], ['6', 'Sales Channels']].map(([n, l]) => (
            <div key={l} className="rounded-xl border border-sidebar-border bg-sidebar-accent p-4">
              <p className="text-2xl font-bold text-white">{n}</p>
              <p className="text-sm text-sidebar-foreground/70">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Sign in</h1>
            <p className="mt-2 text-muted-foreground">Enter your credentials to access your workspace</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization ID</label>
              <input
                {...form.register('orgSlug')}
                placeholder="sva-organics"
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary"
              />
              {form.formState.errors.orgSlug && <p className="text-xs text-destructive">{form.formState.errors.orgSlug.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                {...form.register('email')}
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary"
              />
              {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  {...form.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full rounded-lg border bg-background px-4 py-2.5 pr-10 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-primary"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            First time?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create your workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
