import React, { ComponentProps, ReactNode } from "react";
import * as Accordion from "@radix-ui/react-accordion";

type WidgetProps = {
  title: ReactNode;
};

export function Widget({
  title,
  children,
  ...rest
}: WidgetProps & ComponentProps<typeof Accordion.Item>) {
  return (
    <Accordion.Item {...rest}>
      <Accordion.Header>
        <Accordion.Trigger className="flex h-7 w-full items-center justify-between border-t border-t-slatedark8 bg-slatedark6 px-3 outline-none focus:ring-1 focus:ring-inset focus:ring-bluedark8">
          <span className="text-sm text-slatedark12">{title}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M0.5 5.5L8 12L15.5 5.5" stroke="#6B7176" />
          </svg>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden p-3 data-[state=closed]:animate-slide-up data-[state=open]:animate-slide-down">
        <div
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: "min-content auto" }}
        >
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
