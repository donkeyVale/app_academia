"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";

interface AgendoLogoProps {
  href?: string;
  className?: string;
}

export function AgendoLogo({ href = "/", className = "h-16 w-32" }: AgendoLogoProps) {
  return (
    <div className={className + " relative"}>
      <Link href={href} className="flex items-center w-full h-full">
        <Image
          src="/icons/logoHome.png"
          alt="Agendo"
          fill
          className="object-contain"
          priority
        />
      </Link>
    </div>
  );
}
