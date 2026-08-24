import { revalidateTag } from "next/cache";

const API_SERVER_URL = process.env.API_SERVER_URL ?? "http://localhost:8787";

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

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

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
