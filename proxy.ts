import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInRoute = createRouteMatcher(["/signin"]);
const isPublicRoute = createRouteMatcher([
  "/signin",
  "/api/auth(.*)",
  "/app",        // Mobile PWA – manages its own PIN session
  "/app/(.*)",   // All sub-routes of /app
]);
export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();

  if (isSignInRoute(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/admin/panel");
  }
  if (!isPublicRoute(request) && !authed) {
    const url = new URL(request.url);
    const callbackUrl = url.pathname + url.search;
    return nextjsMiddlewareRedirect(
      request,
      `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }
});

export const config = {
  matcher: [
    // Wyklucz: pliki statyczne Next.js, obrazy, favicon, pliki SVG/PNG/JPG,
    // oraz krytyczne zasoby PWA: sw.js i manifest.webmanifest
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
