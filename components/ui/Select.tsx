import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  error?: boolean
  selectSize?: 'sm' | 'md' | 'lg'
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, selectSize = 'md', ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            // Base styles
            'flex w-full appearance-none rounded-lg border bg-background text-sm transition-all duration-200',
            'ring-offset-background cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
            // Default state
            'border-input focus-visible:ring-ring focus-visible:border-transparent',
            // Error state
            error && 'border-red-500 focus-visible:ring-red-500 bg-red-50/50',
            // Size variants
            {
              'h-8 px-2.5 pr-8 text-xs': selectSize === 'sm',
              'h-10 px-3 pr-10': selectSize === 'md',
              'h-12 px-4 pr-12 text-base': selectSize === 'lg',
            },
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none',
            {
              'h-3.5 w-3.5': selectSize === 'sm',
              'h-4 w-4': selectSize === 'md',
              'h-5 w-5': selectSize === 'lg',
            }
          )}
        />
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
