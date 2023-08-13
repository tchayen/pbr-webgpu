import React, { ComponentProps } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

export function Root(props: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className="flex h-6 w-full shadow-sm"
      {...props}
    />
  );
}

export function Item({
  children,
  ...rest
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      {...rest}
      title={typeof children === "string" ? children : undefined}
      className="flex-1 truncate bg-slatedark7 px-2 text-sm font-semibold text-slatedark12 outline-none first:rounded-l-[4px] last:rounded-r-[4px] hover:bg-slatedark8 data-[state=checked]:bg-bluedark7"
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
