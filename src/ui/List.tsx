import React, { Children, ReactNode, isValidElement } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Chevron } from "./Chevron";
import { twMerge } from "tailwind-merge";

export function List() {
  return (
    <RadioGroupPrimitive.Root
      className="col-span-full flex flex-col"
      style={{
        background: `repeating-linear-gradient(to bottom, rgb(38, 41, 43), rgb(38, 41, 43) 24px, rgb(43, 47, 49) 24px, rgb(43, 47, 49) 48px)`,
      }}
    >
      <Item value="test" />
      <Item value="test1" />
      <Item value="Node">
        <Item value="mesh 1" />
        <Item value="mesh 2" />
        <Item value="mesh 3">
          <Item value="mesh 3.1" />
          <Item value="mesh 3.2" />
        </Item>
      </Item>
    </RadioGroupPrimitive.Root>
  );
}

export function Item({
  value,
  children,
  level,
}: {
  value: string;
  children?: ReactNode;
  level?: number;
}) {
  const padder = (
    <div
      style={{
        width: `${(level ?? 0) * 16}px`,
      }}
    />
  );

  const [selected, setSelected] = React.useState(false);

  if (Children.count(children) > 0) {
    return (
      <Accordion.Root
        type="multiple"
        className="flex"
        onValueChange={() => {
          setSelected(!selected);
        }}
      >
        <Accordion.Item className="group w-full" value={`accordion-${value}`}>
          <RadioGroupPrimitive.Item
            value={`radio-${value}`}
            className="flex h-6 w-full items-center px-2 text-sm text-slatedark12 outline-none data-[state=checked]:bg-bluedark7"
          >
            <Accordion.Header className="flex">
              {padder}
              <Accordion.Trigger className="mr-1 flex h-4 w-4 items-center justify-center rounded outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-bluedark8">
                <Chevron className={twMerge(selected && "rotate-0")} />
              </Accordion.Trigger>
              {value}
            </Accordion.Header>
          </RadioGroupPrimitive.Item>
          <Accordion.Content>
            {Children.map(children, (child) => {
              if (isValidElement(child)) {
                return React.cloneElement(child as any, {
                  level: (level ?? 0) + 1,
                });
              }
            })}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    );
  }

  return (
    <RadioGroupPrimitive.Item
      value={value}
      className="flex h-6 w-full items-center px-2 pl-3 text-sm text-slatedark12 outline-none data-[state=checked]:bg-bluedark7"
    >
      {padder}
      {value}
    </RadioGroupPrimitive.Item>
  );
}
