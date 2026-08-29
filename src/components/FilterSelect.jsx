'use client'

import { useState } from 'react'

export function FilterSelect({ label, name, defaultValue, options, open, onOpen }) {
  const [value, setValue] = useState(defaultValue)
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className="field filter-field--select custom-select">
      <span>{label}</span>
      <input type="hidden" name={name} value={value} />
      <button type="button" className="custom-select__button" onClick={() => onOpen(true)}>
        {selected.label}
      </button>
      {open ? (
        <div className="custom-select__menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? 'custom-select__option custom-select__option--active' : 'custom-select__option'}
              onClick={() => {
                setValue(option.value)
                onOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
