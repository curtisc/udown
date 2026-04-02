import { prisma } from '@/lib/prisma'

export default async function AccessRequestsPage() {
  const pending = await prisma.accessRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })

  const history = await prisma.accessRequest.findMany({
    where: { status: { not: 'PENDING' } },
    include: { respondedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          Pending ({pending.length})
        </h3>
        {pending.length > 0 ? (
          <div className="space-y-2">
            {pending.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
                <div className="flex items-center gap-3">
                  {req.image ? (
                    <img src={req.image} alt={req.name} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-secondary)]">
                      {req.name[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{req.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{req.email}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {req.createdAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--text-secondary)]">No pending requests.</p>
        )}
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Approve or deny requests via the links in the email notification.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">History</h3>
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{req.name} — {req.email}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {req.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--text-secondary)]">No history yet.</p>
        )}
      </div>
    </div>
  )
}
