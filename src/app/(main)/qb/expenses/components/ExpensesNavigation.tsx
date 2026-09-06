'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const expenseRoutes = [
  {
    id: 'vendors',
    title: 'Vendor Analysis',
    href: '/qb/expenses/vendors',
  },
  {
    id: 'bills',
    title: 'Bills',
    href: '/qb/expenses/bills',
  },
]

export default function ExpensesNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const realmId = searchParams.get('realmId')

  return (
    <nav className="mb-6">
      <div className="flex overflow-x-auto scrollbar-hide pb-1">
        <div className="flex min-w-max gap-6 w-full">
          {expenseRoutes.map((route) => {
            const isActive = pathname === route.href
            const href = realmId ? `${route.href}?realmId=${realmId}` : route.href

            return (
              <Link
                key={route.id}
                href={href}
                className={cn(
                  'text-sm font-medium transition-all duration-200 whitespace-nowrap pb-2 border-b-2',
                  isActive
                    ? 'text-amber-600 dark:text-amber-400 border-amber-600 dark:border-amber-400'
                    : 'text-muted-foreground border-transparent hover:text-amber-600 dark:hover:text-amber-400'
                )}
              >
                {route.title}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
