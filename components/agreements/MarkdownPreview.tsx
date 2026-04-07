'use client'

import ReactMarkdown from 'react-markdown'

type Props = {
  markdown: string
  className?: string
}

/**
 * Renders agreement markdown (body) with readable defaults (no @tailwindcss/typography).
 */
export function MarkdownPreview({ markdown, className = '' }: Props) {
  return (
    <div className={`text-slate-800 text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold text-slate-900 mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-800 mt-3 mb-1.5">{children}</h3>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const inline = !className
            return inline ? (
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-800" {...props}>
                {children}
              </code>
            ) : (
              <code className="block rounded-lg bg-slate-900 p-3 text-xs font-mono text-slate-100 overflow-x-auto my-2" {...props}>
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-3">{children}</blockquote>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
