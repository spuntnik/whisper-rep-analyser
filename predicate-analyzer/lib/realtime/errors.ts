export async function summarizeRealtimeFailure(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  const isHtml = contentType.includes("text/html") || /<html[\s>]/i.test(trimmed);

  if (response.status === 503) {
    return `${fallback} The service is temporarily unavailable. Please try again later or use Upload Audio / Record Meeting.`;
  }

  if (isHtml) {
    return `${fallback} The server returned an unexpected HTML error page.`;
  }

  if (!trimmed) {
    return fallback;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}
