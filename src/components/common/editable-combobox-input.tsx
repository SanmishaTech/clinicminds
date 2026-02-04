"use client"

import * as React from "react"
import { Control, FieldValues, Path } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

interface ComboboxOption {
  value: string
  label: string
}

interface EditableComboboxInputProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  required?: boolean
  disabled?: boolean
  className?: string
  inputClassName?: string
  onChange?: (value: string) => void
}

export function EditableComboboxInput<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = "Select or type option...",
  searchPlaceholder = "Search or type...",
  emptyText = "No option found. Press Enter to use custom value.",
  required = false,
  disabled = false,
  className,
  inputClassName,
  onChange,
}: EditableComboboxInputProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [buttonWidth, setButtonWidth] = React.useState<number>(0)

  React.useEffect(() => {
    if (buttonRef.current) {
      setButtonWidth(buttonRef.current.offsetWidth)
    }
  }, [open])

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedOption = options.find((option) => option.value === field.value)
        const displayValue = selectedOption ? selectedOption.label : field.value || ""

        const handleSelectOption = (value: string) => {
          field.onChange(value)
          onChange?.(value)
          setOpen(false)
          setSearchValue("")
        }

        const handleUseCustomValue = () => {
          if (searchValue.trim()) {
            field.onChange(searchValue.trim())
            onChange?.(searchValue.trim())
            setOpen(false)
            setSearchValue("")
          }
        }

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter" && searchValue.trim()) {
            e.preventDefault()
            handleUseCustomValue()
          }
        }

        return (
          <FormItem className={cn("w-full min-w-0", className)}>
            {label && (
              <FormLabel>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </FormLabel>
            )}
            <FormControl>
              <Popover open={open && !disabled} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    ref={buttonRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                      "!w-full min-w-0 justify-between font-normal",
                      !field.value && "text-muted-foreground",
                      disabled && "opacity-50 cursor-not-allowed",
                      inputClassName
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate text-left">
                      {displayValue || placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start" style={{ width: buttonWidth }}>
                  <Command>
                    <CommandInput 
                      placeholder={searchPlaceholder}
                      value={searchValue}
                      onValueChange={setSearchValue}
                      onKeyDown={handleKeyDown}
                    />
                    <CommandList className="p-0">
                      <CommandEmpty className="p-0">
                        <div className="px-2 pt-1">
                          {searchValue.trim() && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              onClick={handleUseCustomValue}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Use "{searchValue.trim()}"
                            </Button>
                          )}
                          <p className="text-sm text-muted-foreground mb-2 mt-2">{emptyText}</p>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {options
                          .filter((option) => 
                            option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                            option.value.toLowerCase().includes(searchValue.toLowerCase())
                          )
                          .map((option) => (
                          <CommandItem
                            key={option.value || '__empty'}
                            value={option.label}
                            keywords={[option.value, option.label]}
                            onSelect={() => handleSelectOption(option.value)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === option.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
