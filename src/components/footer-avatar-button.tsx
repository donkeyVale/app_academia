"use client";

import { UserCircle2 } from "lucide-react";
import React from "react";

interface FooterAvatarButtonProps {
  avatarUrl: string | null;
  initials: string;
  avatarOffsetX: number;
  avatarOffsetY: number;
  onClick: () => void;
  unreadBadgeText?: string;
  hasUnread?: boolean;
  isMenuOpen?: boolean;
}

export const FooterAvatarButton = React.forwardRef<HTMLButtonElement, FooterAvatarButtonProps>(
  (
    { avatarUrl, initials, avatarOffsetX, avatarOffsetY, onClick, unreadBadgeText, hasUnread, isMenuOpen },
    ref,
  ) => {
    const transform = `translate(${avatarOffsetX}%, ${avatarOffsetY - 24}%) scale(1.3)`;

    return (
      <div className="relative">
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className={
            "group relative h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium text-gray-700 overflow-hidden " +
            (avatarUrl ? "bg-transparent" : "bg-gray-200 hover:ring-2 hover:ring-[#3cadaf]")
          }
          aria-label="Abrir menú de usuario"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen ? true : false}
        >
          {avatarUrl ? (
            <span
              className={
                "h-full w-full rounded-full overflow-hidden ring-0 group-hover:ring-2 ring-[#3cadaf]" +
                (hasUnread ? " ring-2" : "")
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            </span>
          ) : initials ? (
            <span className="text-base sm:text-lg inline-block" style={{ transform }}>
              {initials}
            </span>
          ) : (
            <UserCircle2 className="w-6 h-6 text-gray-500" style={{ transform }} />
          )}
        </button>
        {unreadBadgeText ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[18px] text-white">
            {unreadBadgeText}
          </span>
        ) : null}
      </div>
    );
  },
);

FooterAvatarButton.displayName = 'FooterAvatarButton';
