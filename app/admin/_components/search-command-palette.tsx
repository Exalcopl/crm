"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { I } from "../_lib/icons";

interface SearchCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecentSearch {
  id: string;
  title: string;
  subtitle?: string;
  type: "wyceny" | "zlecenia";
  url: string;
  timestamp: number;
}

const RECENT_ITEMS_KEY = "exalco_crm_recent_searches_v1";

function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(item: RecentSearch) {
  if (typeof window === "undefined") return;
  try {
    const items = getRecentSearches().filter((i) => i.id !== item.id);
    items.unshift(item);
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // Ignore storage errors
  }
}

function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_ITEMS_KEY);
  } catch {
    // Ignore
  }
}

export function SearchCommandPalette({ isOpen, onClose }: SearchCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "wyceny" | "zlecenia">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentSearch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search query for Convex
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Determine query types arg
  const typesArg = activeTab === "all" ? ["wyceny", "zlecenia"] : [activeTab];

  // Convex Query
  const searchResults = useQuery(
    api.search.querySearch,
    debouncedQuery.trim().length > 0
      ? { query: debouncedQuery, types: typesArg, limit: 30 }
      : "skip"
  );

  const isLoading = debouncedQuery.trim().length > 0 && searchResults === undefined;

  // Load recent searches on open
  useEffect(() => {
    if (isOpen) {
      setRecentItems(getRecentSearches());
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selectedIndex when results or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults, activeTab, query]);

  // Items to display
  const items = searchResults || [];
  const totalItems = query.trim().length > 0 ? items.length : recentItems.length;

  // Handle Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        setActiveTab((prev) => {
          if (prev === "all") return "wyceny";
          if (prev === "wyceny") return "zlecenia";
          return "all";
        });
        return;
      }

      if (totalItems === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (query.trim().length > 0 && items[selectedIndex]) {
          const selected = items[selectedIndex];
          saveRecentSearch({
            id: selected.id,
            title: selected.title,
            subtitle: selected.subtitle,
            type: selected.type,
            url: selected.url,
            timestamp: Date.now(),
          });
          router.push(selected.url);
          onClose();
        } else if (query.trim().length === 0 && recentItems[selectedIndex]) {
          const selected = recentItems[selectedIndex];
          router.push(selected.url);
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, totalItems, selectedIndex, items, recentItems, query, onClose, router]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  function handleSelectResult(item: {
    id: string;
    title: string;
    subtitle?: string;
    type: "wyceny" | "zlecenia";
    url: string;
  }) {
    saveRecentSearch({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      type: item.type,
      url: item.url,
      timestamp: Date.now(),
    });
    router.push(item.url);
    onClose();
  }

  function handleCopyCode(e: React.MouseEvent, code: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
  }

  return (
    <div className="search-modal-backdrop" onClick={onClose}>
      <div
        className="search-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header Input Area */}
        <div className="search-modal-header">
          <div className="search-input-icon">
            <I.search s={18} />
          </div>

          <input
            ref={inputRef}
            type="text"
            className="search-modal-input"
            placeholder="Szukaj wycen, zleceń, klientów, numerów..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQuery("")}
              title="Wyczyść"
            >
              ✕
            </button>
          )}

          <div className="search-shortcut-badge">Esc</div>
        </div>

        {/* Tab Filters & Quick Info */}
        <div className="search-modal-tabs">
          <div className="tab-buttons">
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              Wszystko
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "wyceny" ? "active" : ""}`}
              onClick={() => setActiveTab("wyceny")}
            >
              Wyceny
            </button>
            <button
              type="button"
              className={`search-tab-btn ${activeTab === "zlecenia" ? "active" : ""}`}
              onClick={() => setActiveTab("zlecenia")}
            >
              Zlecenia
            </button>
          </div>

          <div className="search-quick-hint">
            Użyj <code>w:</code> dla wycen, <code>z:</code> dla zleceń
          </div>
        </div>

        {/* Results Body */}
        <div className="search-modal-body" ref={listRef}>
          {isLoading && (
            <div className="search-state-message">
              <div className="spinner" />
              <span>Wyszukiwanie...</span>
            </div>
          )}

          {!isLoading && query.trim().length > 0 && items.length === 0 && (
            <div className="search-state-message empty">
              <I.search s={32} />
              <p>Brak wyników dla frazy „{query}”</p>
              <span>Spróbuj użyć innej frazy lub innego NIP/telefonu</span>
            </div>
          )}

          {/* Active Search Results */}
          {!isLoading &&
            query.trim().length > 0 &&
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isQuote = item.type === "wyceny";

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`search-result-row ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    className={`search-type-badge ${isQuote ? "badge-quote" : "badge-order"}`}
                  >
                    {isQuote ? "WYCENA" : "ZLECENIE"}
                  </div>

                  <div className="search-row-content">
                    <div className="search-row-title-line">
                      <span className="search-row-title">{item.title}</span>
                      {item.status && (
                        <span
                          className={`search-status-tag status-${item.status.variant}`}
                        >
                          {item.status.label}
                        </span>
                      )}
                    </div>

                    {item.subtitle && (
                      <div className="search-row-subtitle">{item.subtitle}</div>
                    )}

                    {item.details && (
                      <div className="search-row-details">{item.details}</div>
                    )}
                  </div>

                  <div className="search-row-actions">
                    <button
                      type="button"
                      className="search-row-action-btn"
                      title="Kopiuj numer"
                      onClick={(e) => handleCopyCode(e, item.title)}
                    >
                      <I.cog s={12} /> Kopiuj
                    </button>
                    {item.sharepointWebUrl && (
                      <a
                        href={item.sharepointWebUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="search-row-action-btn sharepoint-btn"
                        title="Otwórz folder SharePoint"
                        onClick={(e) => e.stopPropagation()}
                      >
                        SharePoint ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Recent items when query is empty */}
          {!query.trim() && recentItems.length > 0 && (
            <div className="recent-searches-wrapper">
              <div className="recent-header">
                <span>Ostatnio przeglądane</span>
                <button
                  type="button"
                  className="clear-recent-btn"
                  onClick={() => {
                    clearRecentSearches();
                    setRecentItems([]);
                  }}
                >
                  Wyczyść historię
                </button>
              </div>

              {recentItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const isQuote = item.type === "wyceny";

                return (
                  <div
                    key={`recent-${item.id}`}
                    className={`search-result-row ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div
                      className={`search-type-badge ${isQuote ? "badge-quote" : "badge-order"}`}
                    >
                      {isQuote ? "WYCENA" : "ZLECENIE"}
                    </div>

                    <div className="search-row-content">
                      <div className="search-row-title-line">
                        <span className="search-row-title">{item.title}</span>
                      </div>
                      {item.subtitle && (
                        <div className="search-row-subtitle">{item.subtitle}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!query.trim() && recentItems.length === 0 && (
            <div className="search-state-message hint">
              <p>Zacznij pisać, aby wyszukać</p>
              <span>Szukaj po numerze wyceny/zlecenia, nazwie klienta, telefonie, NIP lub notatkach</span>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="search-modal-footer">
          <div className="footer-keys">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Nawigacja</span>
            <span><kbd>↵</kbd> Wybierz</span>
            <span><kbd>Tab</kbd> Zmień typ</span>
            <span><kbd>Esc</kbd> Zamknij</span>
          </div>
        </div>
      </div>
    </div>
  );
}
