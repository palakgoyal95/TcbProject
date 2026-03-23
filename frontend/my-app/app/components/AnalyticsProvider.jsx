"use client";

import { Suspense, useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "../lib/analytics";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const CLOUDFLARE_BEACON_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_BEACON_TOKEN || "";

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const searchQuery = searchParams?.toString() || "";
    const fullPath = searchQuery ? `${pathname}?${searchQuery}` : pathname;
    trackPageView(fullPath || "/");
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsProvider({ children }) {

  return (
    <>
      {GA_MEASUREMENT_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}

      {CLOUDFLARE_BEACON_TOKEN ? (
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          defer
          data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN })}
        />
      ) : null}

      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>

      {children}
    </>
  );
}
