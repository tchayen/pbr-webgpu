"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { twMerge } from "tailwind-merge";
import { ComponentProps } from "react";
import { Chevron } from "./Chevron";

export const Root = SelectPrimitive.Root;
export const Group = SelectPrimitive.Group;

export function Value({
  ...props
}: ComponentProps<typeof SelectPrimitive.Value>) {
  return (
    <span className="text-sm text-slatedark12 placeholder:text-slatedark10">
      <SelectPrimitive.Value {...props} />
    </span>
  );
}

export function Trigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={twMerge(
        "flex h-6 min-w-0 items-center justify-between rounded-[4px] bg-slatedark1 px-2 py-2 outline-none focus-visible:ring-1 focus-visible:ring-bluedark8 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="truncate text-slatedark12">{children}</span>
      <SelectPrimitive.Icon asChild>
        <Chevron />
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
          "relative z-50 overflow-hidden rounded-[4px] bg-slatedark1 text-slatedark12 shadow-lg data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
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
        "relative flex h-6 w-full cursor-default select-none items-center justify-between px-2 text-sm text-slatedark12 outline-none last:mb-0 focus:bg-slatedark6 data-[disabled]:pointer-events-none data-[state=checked]:bg-bluedark8 data-[disabled]:text-slatedark9",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        {/* <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1 7.7619L5.8125 13L15 3" stroke="white" />
        </svg> */}
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
