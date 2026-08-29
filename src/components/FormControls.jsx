"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dropdown kustom yang meniru perilaku <select> native.
 * onChange menerima { target: { name, value } } agar kompatibel
 * dengan updateField / handler form yang sudah ada.
 */
export function SelectField({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Pilih…",
  allowEmpty = false,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const optionRefs = useRef([]);

  const effectiveOptions = allowEmpty
    ? [{ value: "", label: placeholder }, ...options]
    : options;

  const selected = options.find((option) => option.value === value);
  const hasValue = value !== "" && value != null && selected != null;

  // Tutup saat klik di luar menu atau tekan Escape
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Fokus opsi yang disorot (akses keyboard) saat menu terbuka
  useEffect(() => {
    if (!open) return;
    const el = optionRefs.current[highlight];
    if (el) el.focus({ preventScroll: true });
  }, [open, highlight]);

  function pick(option) {
    setOpen(false);
    onChange({ target: { name, value: option.value } });
  }

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    const index = effectiveOptions.findIndex((option) => option.value === value);
    setHighlight(index >= 0 ? index : 0);
    setOpen(true);
  }

  function handleMenuKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, effectiveOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = effectiveOptions[highlight];
      if (option) pick(option);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div
      className={`select-field${open ? " select-field--open" : ""} ${className}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`select-field__button${hasValue ? "" : " select-field__button--empty"}`}
        onClick={() => toggleMenu()}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{hasValue ? selected.label : placeholder}</span>
      </button>

      {open ? (
        <div
          className="select-field__menu"
          role="listbox"
          onKeyDown={handleMenuKeyDown}
        >
          {effectiveOptions.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={String(option.value)}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              className={[
                "select-field__option",
                option.value === value ? "select-field__option--active" : "",
                index === highlight ? "select-field__option--highlight" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </div>
  );
}

/**
 * Radio kustom bergaya kartu.
 * onChange menerima { target: { name, value } } agar kompatibel
 * dengan updateField / handler form yang sudah ada.
 */
export function RadioGroup({
  name,
  value,
  onChange,
  options = [],
  columns = 2,
  className = "",
}) {
  return (
    <div
      className={`radio-group ${className}`}
      style={{ "--radio-columns": columns }}
      role="radiogroup"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            key={String(option.value)}
            className={`radio-option${active ? " radio-option--active" : ""}`}
            onClick={() => onChange({ target: { name, value: option.value } })}
          >
            <span className="radio-option__dot" aria-hidden="true" />
            <span className="radio-option__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
