"use client";

import { useState } from "react";

// Drop your own logo at public/logo.svg (or .png and update the src) to replace the
// placeholder mark. Falls back to a wordmark if the file is missing.
export default function Logo() {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="flex items-center gap-2 select-none pr-1">
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.svg"
          alt="MyView"
          width={24}
          height={24}
          onError={() => setImgOk(false)}
        />
      )}
      <span className="font-semibold tracking-tight text-[15px]">
        My<span className="text-[#2962ff]">View</span>
      </span>
    </div>
  );
}
