"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { twMerge } from "tailwind-merge";

export const Root = SelectPrimitive.Root;
export const Group = SelectPrimitive.Group;
export const Value = SelectPrimitive.Value;

export function Trigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={twMerge(
        "flex h-8 w-full items-center justify-between rounded-md border border-slate7 bg-slate1 px-3 py-2 text-sm text-slate12 ring-offset-slate3 placeholder:text-slate10 focus:border-indigo8 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <svg
          width="10"
          height="8"
          viewBox="0 0 10 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10 0H0L5 8L10 0Z" fill="#697177" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function Content({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={twMerge(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate7 bg-slate1 text-slate12 shadow-sm data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position="popper"
        {...props}
      >
        <SelectPrimitive.Viewport
          className={twMerge(
            "p-1",
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function Label({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={twMerge("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
      {...props}
    />
  );
}

export function Item({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={twMerge(
        "relative flex w-full cursor-default select-none items-center rounded-[4px] px-2 py-1.5 text-sm outline-none focus:bg-slate4 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
