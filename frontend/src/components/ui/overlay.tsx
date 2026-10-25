import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------ Sheet (side drawer)

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

interface SheetContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  side?: 'left' | 'right'
  title: ReactNode
  description?: ReactNode
  hideTitle?: boolean
  closeLabel: string
}

export function SheetContent({ side = 'right', title, description, hideTitle, closeLabel, className, children, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-[fade-out_150ms] data-[state=open]:animate-[fade-in_200ms]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-full max-w-md flex-col bg-background text-foreground shadow-2xl outline-none',
          side === 'right'
            ? 'right-0 data-[state=closed]:animate-[slide-out-right_200ms_ease-in] data-[state=open]:animate-[slide-in-right_280ms_cubic-bezier(0.16,1,0.3,1)]'
            : 'left-0 data-[state=closed]:animate-[slide-out-left_200ms_ease-in] data-[state=open]:animate-[slide-in-left_280ms_cubic-bezier(0.16,1,0.3,1)]',
          className,
        )}
        {...props}
      >
        <div className={cn('flex items-center justify-between gap-4 border-b border-border px-5 py-4', hideTitle && 'sr-only')}>
          <div>
            <DialogPrimitive.Title className="font-display text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-xs text-muted-foreground">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label={closeLabel}>
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {!description ? <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description> : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// ------------------------------------------------------------------ Dialog (centered modal)

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

interface DialogContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode
  description?: ReactNode
  closeLabel: string
  hideHeader?: boolean
}

export function DialogContent({ title, description, closeLabel, hideHeader, className, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-[state=closed]:animate-[fade-out_150ms] data-[state=open]:animate-[fade-in_200ms]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          'rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none data-[state=open]:animate-[pop-in_220ms_cubic-bezier(0.16,1,0.3,1)]',
          className,
        )}
        {...props}
      >
        <div className={cn('mb-5 pr-8', hideHeader && 'sr-only')}>
          <DialogPrimitive.Title className="font-display text-xl font-semibold">{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
        </div>
        {!description ? <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description> : null}
        <DialogPrimitive.Close className="absolute top-4 right-4 grid size-9 place-items-center rounded-full hover:bg-muted" aria-label={closeLabel}>
          <X className="size-5" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// ------------------------------------------------------------------ Dropdown menu

export const Menu = Dropdown.Root
export const MenuTrigger = Dropdown.Trigger
export const MenuGroup = Dropdown.Group
export const MenuRadioGroup = Dropdown.RadioGroup

export function MenuContent({ className, align = 'end', sideOffset = 8, ...props }: ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-2xl border border-border bg-card p-1.5 text-card-foreground shadow-soft',
          'data-[state=open]:animate-[pop-in_160ms_ease-out]',
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  )
}

const itemClass =
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-colors ' +
  'data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground'

export function MenuItem({ className, ...props }: ComponentProps<typeof Dropdown.Item>) {
  return <Dropdown.Item className={cn(itemClass, className)} {...props} />
}

export function MenuRadioItem({ className, children, ...props }: ComponentProps<typeof Dropdown.RadioItem>) {
  return (
    <Dropdown.RadioItem className={cn(itemClass, 'pr-8 data-[state=checked]:font-semibold', className)} {...props}>
      {children}
      <Dropdown.ItemIndicator className="absolute right-3 size-2 rounded-full bg-primary" />
    </Dropdown.RadioItem>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof Dropdown.Label>) {
  return <Dropdown.Label className={cn('px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase', className)} {...props} />
}

export function MenuSeparator({ className }: { className?: string }) {
  return <Dropdown.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} />
}
