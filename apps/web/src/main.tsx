import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./features/auth/AuthContext";
import { router } from "./routes/router";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Auto-hiding overlay scrollbars: reveal thumb while scrolling or wheeling, then fade out
if (typeof window !== "undefined") {
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  const onUserScroll = () => {
    document.documentElement.classList.add("is-scrolling");
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      document.documentElement.classList.remove("is-scrolling");
    }, 1000);
  };

  window.addEventListener("scroll", onUserScroll, { capture: true, passive: true });
  window.addEventListener("wheel", onUserScroll, { capture: true, passive: true });
  window.addEventListener("touchmove", onUserScroll, { capture: true, passive: true });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
