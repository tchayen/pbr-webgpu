import React, { ComponentProps, ReactNode } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { Chevron } from "./Chevron";

type WidgetProps = {
  title: ReactNode;
};

export function Widget({
  title,
  children,
  ...rest
}: WidgetProps & ComponentProps<typeof Accordion.Item>) {
  return (
    <Accordion.Item
      {...rest}
      className="overflow-hidden rounded-[4px] bg-slatedark4"
    >
      <Accordion.Header>
        <Accordion.Trigger className="flex h-6 w-full items-center justify-between rounded-[4px]  bg-gradient-to-b from-slatedark6 to-slatedark5 px-2 font-medium outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-bluedark8">
          <span className="text-sm text-slatedark12">{title}</span>
          <Chevron />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden p-2 pl-4 data-[state=closed]:animate-slide-up data-[state=open]:animate-slide-down">
        <div
          className="grid items-center gap-2 gap-x-4"
          style={{ gridTemplateColumns: "min-content auto" }}
        >
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
