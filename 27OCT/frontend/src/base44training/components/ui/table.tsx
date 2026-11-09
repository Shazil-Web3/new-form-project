import * as React from "react"

import { cn } from "../../lib/utils"

const Table = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props} />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-b44-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props} />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-b44-muted/50 data-[state=selected]:bg-b44-muted",
      className
    )}
    {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-b44-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props} />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<any, any>(({ className, ...props }: any, ref: any) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-b44-muted-foreground", className)}
    {...props} />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
