"use client"

import * as React from "react"
import { Control, FieldValues, Path } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { AppCombobox } from "./app-combobox"

interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxInputProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  required?: boolean
  className?: string
  inputClassName?: string
  onChange?: (value: string) => void
}

export function ComboboxInput<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  required = false,
  className,
  inputClassName,
  onChange,
}: ComboboxInputProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <AppCombobox
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                onChange?.(value);
              }}
              options={options}
              placeholder={placeholder}
              searchPlaceholder={searchPlaceholder}
              emptyText={emptyText}
              className={inputClassName}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
