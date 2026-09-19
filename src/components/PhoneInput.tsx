'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import {
  Country,
  COUNTRIES,
  DEFAULT_COUNTRY,
  getCountryByCode,
  parsePhoneNumber,
  formatPhoneNumber,
  isValidPhoneNumber,
} from '@/constants/countries';

export interface PhoneInputProps {
  value: string;
  onChange: (value: string, details?: { country: Country; nationalNumber: string; e164: string }) => void;
  defaultCountryCode?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  showErrorText?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  defaultCountryCode = DEFAULT_COUNTRY.code,
  placeholder,
  disabled = false,
  required = false,
  error,
  className = '',
  inputClassName = '',
  id,
  name,
  autoFocus = false,
  showErrorText = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Determine initial country & national number from value or default
  const defaultC = getCountryByCode(defaultCountryCode) || DEFAULT_COUNTRY;
  const parsed = parsePhoneNumber(value || '', defaultC);
  const [selectedCountry, setSelectedCountry] = useState<Country>(parsed.country);

  // Sync country if incoming value has an explicit dial code of another country
  useEffect(() => {
    if (value && value.trim()) {
      const p = parsePhoneNumber(value, selectedCountry);
      if (p.country.code !== selectedCountry.code) {
        setSelectedCountry(p.country);
      }
    }
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter countries by search query
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  // Extract pure national number without dial code
  const getNationalDigits = () => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
    if (digits.startsWith(dialDigits)) {
      return digits.slice(dialDigits.length);
    }
    return digits;
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch('');
    const natDigits = getNationalDigits();
    const newE164 = natDigits ? `${country.dialCode}${natDigits}` : '';
    onChange(newE164, {
      country,
      nationalNumber: natDigits,
      e164: newE164,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    
    // If the user pastes something starting with + or 00, re-parse completely
    if (raw.startsWith('+') || raw.startsWith('00')) {
      const p = parsePhoneNumber(raw, selectedCountry);
      setSelectedCountry(p.country);
      onChange(p.e164, {
        country: p.country,
        nationalNumber: p.nationalNumber,
        e164: p.e164,
      });
      return;
    }

    const digits = raw.replace(/\D/g, '');
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
    
    // If user typed dial digits at the beginning, strip them
    let nat = digits;
    if (nat.startsWith(dialDigits)) {
      nat = nat.slice(dialDigits.length);
    }

    const newE164 = nat ? `${selectedCountry.dialCode}${nat}` : '';
    onChange(newE164, {
      country: selectedCountry,
      nationalNumber: nat,
      e164: newE164,
    });
  };

  const nationalDigits = getNationalDigits();
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : undefined;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center bg-gray-50/70 hover:bg-gray-50 focus-within:bg-white border rounded-2xl transition-all duration-200 ${
          hasError
            ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20'
            : 'border-gray-200/80 focus-within:border-[#f56b2a] focus-within:ring-2 focus-within:ring-[#f56b2a]/15'
        }`}
      >
        {/* Country Selector Trigger */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 pl-3.5 pr-2 py-3 md:py-3.5 text-xs font-semibold text-gray-700 hover:text-gray-900 border-r border-gray-200/70 transition-colors focus:outline-none disabled:opacity-50 select-none cursor-pointer rounded-l-2xl shrink-0"
            title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="text-[11px] font-bold text-gray-800 tracking-tight">
              {selectedCountry.dialCode}
            </span>
            <ChevronDown
              size={13}
              className={`text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#f56b2a]' : ''
              }`}
            />
          </button>

          {/* Searchable Country Dropdown Popover */}
          {isOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 max-w-[90vw] bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
              {/* Search Bar */}
              <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher pays ou indicatif..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#f56b2a] focus:ring-1 focus:ring-[#f56b2a]"
                  />
                </div>
              </div>

              {/* Country List */}
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-50/50 overscroll-contain">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((c) => {
                    const isSelected = c.code === selectedCountry.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50/80 font-bold text-[#f56b2a]'
                            : 'hover:bg-gray-50 text-gray-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <span className="text-base shrink-0">{c.flag}</span>
                          <span className="truncate">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-mono text-gray-500 font-semibold">
                            {c.dialCode}
                          </span>
                          {isSelected && <Check size={14} className="text-[#f56b2a]" />}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-gray-400 font-normal">
                    Aucun pays trouvé
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* National Number Input */}
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          value={nationalDigits}
          onChange={handleInputChange}
          placeholder={placeholder || selectedCountry.placeholder || 'Numéro de téléphone'}
          className={`w-full px-3.5 py-3 md:py-3.5 bg-transparent text-sm font-semibold text-gray-800 placeholder-gray-400 outline-none rounded-r-2xl transition-all ${inputClassName}`}
        />
      </div>

      {showErrorText && errorMessage && (
        <p className="text-[10px] font-semibold text-red-500 mt-1 px-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default PhoneInput;
