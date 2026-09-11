"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { I } from "../_lib/icons";
import type { Id } from "@/convex/_generated/dataModel";

// Web Audio API synthesized soft notification chime
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First chime tone (high soft sine)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Second chime tone (warm A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Ignore audio autoplay restrictions if user hasn't interacted
  }
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffHour < 24) return `${diffHour} godz. temu`;
  if (diffDay === 1) return "wczoraj";
  return `${diffDay} dni temu`;
}

export function NotificationCenter() {
  const router = useRouter();
  const data = useQuery(api.notifications.list);
  const settings = useQuery(api.notifications.getSettings);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number | null>(null);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const latestNotification = notifications[0];

  // Play audio sound and trigger Toast when a NEW unread notification arrives
  useEffect(() => {
    if (data === undefined) return;

    if (prevCountRef.current !== null && unreadCount > prevCountRef.current) {
      if (settings?.soundEnabled) {
        playNotificationSound();
      }
      if (latestNotification && !latestNotification.isRead) {
        toast(latestNotification.title, {
          description: latestNotification.message,
          action: {
            label: "Otwórz",
            onClick: () => {
              markAsRead({ notificationId: latestNotification._id });
              router.push(latestNotification.link);
            },
          },
        });
      }
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, data, latestNotification, settings, markAsRead, router]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (id: Id<"notifications">, link: string) => {
    await markAsRead({ notificationId: id });
    setIsOpen(false);
    router.push(link);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative" }} ref={popoverRef}>
      {/* Bell Button with Badge */}

      <button
        type="button"
        className={`icon-btn notification-bell-btn ${unreadCount > 0 ? "has-unread" : ""}`}
        title="Powiadomienia"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ position: "relative" }}
      >
        <I.bell s={17} />
        {unreadCount > 0 && (
          <span className="notification-badge-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div className="fluent-notification-popover">
          <div className="popover-header">
            <div className="popover-title-row">
              <span className="popover-title">Powiadomienia</span>
              {unreadCount > 0 && (
                <span className="popover-unread-pill">{unreadCount} nieprzeczytane</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="popover-action-btn"
                onClick={handleMarkAllRead}
              >
                Oznacz wszystkie jako przeczytane
              </button>
            )}
          </div>

          <div className="popover-body">
            {notifications.length === 0 ? (
              <div className="popover-empty">
                <I.bell s={24} />
                <span>Brak powiadomień w ciągu ostatnich 30 dni</span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  className={`notification-item ${item.isRead ? "read" : "unread"}`}
                  onClick={() => handleNotificationClick(item._id, item.link)}
                >
                  <div className={`item-icon ${item.type}`}>
                    {item.type === "new_quote" ? (
                      <span>📄</span>
                    ) : item.type === "new_order" ? (
                      <span>📦</span>
                    ) : (
                      <span>ℹ️</span>
                    )}
                  </div>
                  <div className="item-content">
                    <div className="item-header">
                      <span className="item-title">{item.title}</span>
                      <span className="item-time">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    <div className="item-message">{item.message}</div>
                  </div>
                  {!item.isRead && <span className="item-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
