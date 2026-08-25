import { revalidateTag } from "next/cache";

const API_SERVER_URL = process.env.API_SERVER_URL ?? "http://localhost:8787";

async function fetchWithRetry(targetUrl, init, retries = 1) {
  try {
    return await fetch(targetUrl, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const causeCode = err?.cause?.code;
    const isRetryable =
      causeCode === "ECONNRESET" ||
      causeCode === "ETIMEDOUT" ||
      err?.code === "ECONNRESET" ||
      String(err?.message ?? "").includes("ECONNRESET") ||
      String(err?.message ?? "").includes("fetch failed");
    if (retries > 0 && isRetryable) {
      await new Promise((r) => setTimeout(r, 300));
      return fetchWithRetry(targetUrl, init, retries - 1);
    }
    throw err;
  }
}

async function proxy(request, { params }) {
  const { path } = await params;
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(
    `/api/${path.join("/")}${sourceUrl.search}`,
    API_SERVER_URL,
  );
  const headers = new Headers(request.headers);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;

  headers.delete("host");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("connection");

  let response;
  try {
    response = await fetchWithRetry(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (err) {
    const cause = err?.cause ?? err;
    console.error(
      `[proxy] fetch failed ${request.method} ${targetUrl.toString()} -> ${API_SERVER_URL}:`,
      cause?.code ?? err?.code ?? err?.message,
      cause,
    );
    return new Response(
      JSON.stringify({
        error: "Upstream unavailable",
        details: cause?.code ?? err?.message ?? "ECONNRESET",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (hasBody && response.ok) {
    revalidateApiTags(path, body);
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

function revalidateApiTags(path, body) {
  const [resource, scope, id] = path;
  const tags = new Set();

  if (resource === "places") {
    tags.add("places");
    if (id) tags.add(`place:${id}`);
  }

  if (resource === "reviews") {
    tags.add("places");
    const placeId = readJsonNumber(body, "placeId");
    if (placeId) {
      tags.add(`place:${placeId}`);
    }
  }

  if (resource === "wifi") {
    tags.add("places");
    const credId = id ? Number(id) : null;
    if (credId) tags.add(`place:wifi:${credId}`);
  }

  if (resource === "places" && scope && id === "speedtest") {
    tags.add("places");
    const pid = Number(scope);
    if (Number.isFinite(pid)) tags.add(`place:${pid}`);
    const bodyPlace = readJsonNumber(body, "placeId");
    if (bodyPlace) tags.add(`place:${bodyPlace}`);
  }

  if (resource === "admin" && scope === "submissions") {
    tags.add("places");
    if (id) {
      tags.add(`place:${id}`);
    }
  }
  if (resource === "admin" && scope === "wifi") {
    tags.add("places");
    if (id) tags.add(`place:${id}`);
  }

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}

function readJsonNumber(body, key) {
  try {
    const value = JSON.parse(body || "{}")?.[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
