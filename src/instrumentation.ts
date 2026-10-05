import type { Instrumentation } from "next";

// Server errors (pages, route handlers, proxy) go to the app's error log
// (sql/12_app_errors.sql), readable by supervisors on /studio/admin.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { errorPath, logAppError } = await import("@/lib/errorLog");
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  await logAppError("server", message, `${context.routeType} ${errorPath(request.path)}`, { digest });
};
