import { Construction } from 'lucide-react'

export function ComingSoon({ module, description }: { module: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-96 gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-xl font-bold">{module}</h2>
        <p className="mt-2 max-w-md text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        Phase 1 Foundation complete — module build starts next sprint
      </div>
    </div>
  )
}
