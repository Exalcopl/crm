"use client";

import { getUserColor, getInitials } from "../_lib/users";
import { toast } from "sonner";

type UserLike = {
  _id: string;
  name?: string | null;
  email?: string | null;
};

export function UserFilterBar({
  users,
  selectedUserIds,
  onToggle,
  currentUserId,
  maxSelection = 4,
  label = "Filtruj kalendarze",
  variant = "avatar",
}: {
  users: UserLike[];
  selectedUserIds: string[];
  onToggle: (id: string, isCurrent: boolean) => void;
  currentUserId?: string;
  maxSelection?: number;
  label?: string;
  variant?: "avatar" | "chip";
}) {
  if (users.length === 0) return null;

  if (variant === "avatar") {
    return (
      <div className="cal-user-filter-bar">
        <span className="cal-filter-label">{label}</span>
        <div className="cal-filter-chips">
          {users.map((u) => {
            const isSelected = selectedUserIds.includes(u._id);
            const color = getUserColor(u._id);
            const isMe = u._id === currentUserId;
            const initials = getInitials(u.name, u.email);
            const fullName = isMe ? "Mój kalendarz" : u.name || u.email || "Użytkownik";

            return (
              <button
                key={u._id}
                type="button"
                title={fullName}
                className={`cal-filter-avatar ${isSelected ? "cal-filter-avatar--active" : ""}`}
                style={
                  isSelected
                    ? {
                        borderColor: color,
                        background: `${color}18`,
                        color: "#ffffff",
                        boxShadow: `0 0 12px ${color}25`,
                      }
                    : {}
                }
                onClick={() => {
                  if (!isSelected && selectedUserIds.length >= maxSelection && !isMe) {
                    toast.warning(`Możesz wybrać maksymalnie ${maxSelection} elementów`);
                    return;
                  }
                  onToggle(u._id, isMe);
                }}
              >
                {initials}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="cal-user-filter-bar" style={{ borderBottom: "none", padding: "0 0 16px 0", background: "transparent" }}>
      <span className="cal-filter-label">{label}</span>
      <div className="cal-category-chips" style={{ flexWrap: "wrap", overflow: "visible" }}>
        <button
          type="button"
          className={`cal-category-chip ${selectedUserIds.length === 0 ? "cal-category-chip--active" : ""}`}
          style={
            selectedUserIds.length === 0
              ? {
                  borderColor: "#3b82f6",
                  color: "#ffffff",
                  background: "rgba(59, 130, 246, 0.15)",
                  boxShadow: "0 0 12px rgba(59, 130, 246, 0.2)",
                }
              : {
                  borderColor: "#30363d",
                }
          }
          onClick={() => {
            // "Wszystkie" clears the selection
            users.forEach((u) => {
              if (selectedUserIds.includes(u._id)) onToggle(u._id, u._id === currentUserId);
            });
          }}
        >
          <span className="cal-category-chip-dot" style={{ backgroundColor: "#ffffff" }} />
          Wszystkie
        </button>

        {users.map((u) => {
          const isSelected = selectedUserIds.includes(u._id);
          const color = getUserColor(u._id);
          const isMe = u._id === currentUserId;
          const fullName = isMe ? "Mój kalendarz" : u.name || u.email || "Użytkownik";

          return (
            <button
              key={u._id}
              type="button"
              title={fullName}
              className={`cal-category-chip ${isSelected ? "cal-category-chip--active" : ""}`}
              style={
                isSelected
                  ? {
                      borderColor: color,
                      color: "#ffffff",
                      background: `${color}25`,
                      boxShadow: `0 0 12px ${color}20`,
                    }
                  : {
                      borderColor: "#30363d",
                    }
              }
              onClick={() => {
                if (!isSelected && selectedUserIds.length >= maxSelection && !isMe) {
                  toast.warning(`Możesz wybrać maksymalnie ${maxSelection} elementów`);
                  return;
                }
                onToggle(u._id, isMe);
              }}
            >
              <span className="cal-category-chip-dot" style={{ backgroundColor: color }} />
              {fullName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
