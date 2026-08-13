"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A `<Link>` that prefetches the *whole* destination only once the user shows
 * intent (hover, touch, or keyboard focus).
 *
 * Why not just use `<Link>`: the customer detail route is `force-dynamic`, and
 * Next.js only prefetches a dynamic route down to its nearest `loading.tsx`
 * boundary. That prefetches the skeleton, not the customer -- so clicking
 * still waited on the server. `prefetch={true}` prefetches dynamic routes in
 * full, which is what actually makes the page open instantly.
 *
 * Why not `prefetch={true}` outright: `<Link>` prefetches on entering the
 * viewport, so a 25-row customer list would render 25 full customer detail
 * pages on the server -- call history, stats and all -- to serve one click.
 * That is precisely the "prefetch huge call histories for every customer"
 * this must not do. Gating on intent means the database only does the work
 * for customers the agent has actually pointed at, and a page of links costs
 * nothing until then.
 *
 * `prefetch={false} -> true` rather than the docs' `false -> null`: `null`
 * restores the *default*, which for a dynamic route is the loading-boundary
 * prefetch again -- i.e. not the data. `true` also parks the result in the
 * `staleTimes.static` bucket (180s, see next.config.ts) instead of the 30s
 * dynamic one, so hover -> click -> back -> click stays warm.
 *
 * Intent is sticky: once armed, the link keeps its prefetch rather than
 * tearing it down on mouse-out, so sweeping the cursor back over a row does
 * not re-request it.
 */
export function HoverPrefetchLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [intent, setIntent] = useState(false);
  const arm = () => setIntent(true);

  return (
    <Link
      href={href}
      prefetch={intent}
      onMouseEnter={arm}
      onFocus={arm}
      onTouchStart={arm}
      className={className}
      title={title}
    >
      {children}
    </Link>
  );
}
