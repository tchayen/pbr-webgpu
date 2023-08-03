"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { twMerge } from "tailwind-merge";
import { ComponentProps } from "react";

export const Root = SelectPrimitive.Root;
export const Group = SelectPrimitive.Group;
export const Value = SelectPrimitive.Value;

export function Trigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={twMerge(
        "flex h-7 items-center justify-between rounded-[4px] bg-slatedark1 px-3 py-2 text-sm text-slatedark12 placeholder:text-slatedark10 focus:ring-1 focus:ring-bluedark8 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:ring-offset-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0.5 5.5L8 12L15.5 5.5" stroke="#6B7176" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function Content({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={twMerge(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 min-w-[8rem] overflow-hidden rounded-[4px] bg-slatedark1 text-slatedark12 shadow-sm data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position="popper"
        {...props}
      >
        <SelectPrimitive.Viewport
          className={twMerge(
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
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
}: ComponentProps<typeof SelectPrimitive.Label>) {
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
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={twMerge(
        "data-[state=checked]:bg-bluedark8 flex justify-between text-slatedark12 h-7 relative w-full cursor-default select-none items-center px-3 text-sm outline-none focus:bg-slatedark4 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1 7.7619L5.8125 13L15 3" stroke="white" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
