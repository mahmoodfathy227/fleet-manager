import { cn } from '@/lib/utils'
import { LabelHTMLAttributes, forwardRef } from 'react'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  optional?: boolean
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, optional, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none text-gray-700',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-red-500" aria-hidden="true">*</span>
      )}
      {optional && (
        <span className="ml-1 text-gray-400 font-normal text-xs">(optional)</span>
      )}
    </label>
  )
)
Label.displayName = 'Label'

export { Label }
export type { LabelProps }
