import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, inputSize = 'md', leftIcon, rightIcon, ...props }, ref) => {
    const inputElement = (
      <input
        type={type}
        className={cn(
          // Base styles
          'flex w-full rounded-lg border bg-background text-sm transition-all duration-200',
          'ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
          // Default state
          'border-input focus-visible:ring-ring focus-visible:border-transparent',
          // Error state
          error && 'border-red-500 focus-visible:ring-red-500 bg-red-50/50',
          // Size variants
          {
            'h-8 px-2.5 text-xs': inputSize === 'sm',
            'h-10 px-3': inputSize === 'md',
            'h-12 px-4 text-base': inputSize === 'lg',
          },
          // Icon padding
          leftIcon && 'pl-10',
          rightIcon && 'pr-10',
          className
        )}
        ref={ref}
        {...props}
      />
    )

    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          {inputElement}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
      )
    }

    return inputElement
  }
)
Input.displayName = 'Input'

export { Input }
