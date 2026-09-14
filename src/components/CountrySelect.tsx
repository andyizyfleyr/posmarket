'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, MapPin } from 'lucide-react';
import { Country, COUNTRIES, getCountryByName, getCountryByCode } from '@/constants/countries';

export interface CountrySelectProps {
  value?: string;
  onChange: (countryName: string, country: Country) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | boolean;
  className?: string;
  id?: string;
  name?: string;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value = '',
  onChange,
  placeholder = 'Sélectionner un pays',
  disabled = false,
  required = false,
  error,
  className = '',
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = getCountryByName(value) || getCountryByCode(value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const filteredCountries = COUNTRIES.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  const handleSelect = (c: Country) => {
    onChange(c.name, c);
    setIsOpen(false);
    setSearch('');
  };

  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : undefined;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-3 md:py-3.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border rounded-2xl text-left text-sm font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 ${
          hasError
            ? 'border-red-300 ring-2 ring-red-100 bg-red-50/20'
            : 'border-gray-200/80 focus:border-[#f56b2a] focus:ring-2 focus:ring-[#f56b2a]/15'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedCountry ? (
            <>
              <span className="text-base shrink-0">{selectedCountry.flag}</span>
              <span className="truncate text-gray-800">{selectedCountry.name}</span>
            </>
          ) : (
            <span className="text-gray-400 font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#f56b2a]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
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
                placeholder="Rechercher un pays..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#f56b2a] focus:ring-1 focus:ring-[#f56b2a]"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50/50 overscroll-contain">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((c) => {
                const isSelected = selectedCountry?.code === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/80 font-black text-[#f56b2a]'
                        : 'hover:bg-gray-50 text-gray-700 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <span className="text-base shrink-0">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-[#f56b2a] shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-gray-400 font-medium">
                Aucun pays trouvé
              </div>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="text-[10px] font-bold text-red-500 mt-1 px-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default CountrySelect;
