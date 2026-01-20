'use client';

import { useState, useRef, useEffect } from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type MultiSelectInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues>;
  name: TName;
  label?: string;
  placeholder?: string;
  options: Option[];
  disabled?: boolean;
  className?: string;
  span?: number;
  spanFrom?: 'sm' | 'md' | 'lg' | 'xl';
};

export function MultiSelectInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  placeholder = 'Select options...',
  options,
  disabled = false,
  className,
  span,
  spanFrom,
}: MultiSelectInputProps<TFieldValues, TName>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPlacement, setDropdownPlacement] = useState<'bottom' | 'top'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updatePlacement = () => {
      const containerEl = containerRef.current;
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current?.offsetHeight ?? 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const shouldOpenUp = spaceBelow < dropdownHeight + 8 && spaceAbove > spaceBelow;

      setDropdownPlacement(shouldOpenUp ? 'top' : 'bottom');
    };

    const raf = requestAnimationFrame(updatePlacement);
    const handleResize = () => updatePlacement();
    const handleScroll = () => updatePlacement();

    window.addEventListener('resize', handleResize);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const getSpanClasses = () => {
    if (!span || !spanFrom) return '';
    return `${spanFrom}:col-span-${span}`;
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedValues: string[] = Array.isArray(field.value) ? field.value : [];
        
        const handleToggleOption = (optionValue: string) => {
          const newValues = selectedValues.includes(optionValue)
            ? selectedValues.filter((v: string) => v !== optionValue)
            : [...selectedValues, optionValue];
          field.onChange(newValues);
        };

        const handleRemoveOption = (optionValue: string) => {
          const newValues = selectedValues.filter((v: string) => v !== optionValue);
          field.onChange(newValues);
        };

        const selectedOptions = options.filter(option => selectedValues.includes(option.value));

        return (
          <FormItem className={cn('space-y-2', getSpanClasses(), className)}>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              <div ref={containerRef} className="relative">
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isOpen}
                  className={cn(
                    "w-full justify-between text-left font-normal",
                    selectedValues.length === 0 && "text-muted-foreground"
                  )}
                  disabled={disabled}
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <div className="flex flex-wrap gap-1 flex-1">
                    {selectedValues.length === 0 ? (
                      <span>{placeholder}</span>
                    ) : (
                      selectedOptions.map((option) => (
                        <Badge
                          key={option.value}
                          variant="secondary"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveOption(option.value);
                          }}
                        >
                          {option.label}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))
                    )}
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                
                {isOpen && (
                  <div
                    ref={dropdownRef}
                    className={cn(
                      'absolute z-50 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto',
                      dropdownPlacement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'
                    )}
                  >
                    <div className="p-1">
                      {options.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No options available
                        </div>
                      ) : (
                        options.map((option) => {
                          const isSelected = selectedValues.includes(option.value);
                          return (
                            <div
                              key={option.value}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-accent"
                              )}
                              onClick={() => handleToggleOption(option.value)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {option.label}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
