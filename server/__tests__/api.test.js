import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";

// Environment variables must be set BEFORE the server module is loaded
process.env.NODE_ENV = "test";
process.env.ADMIN_TOKEN = "test-admin-token";
// Force in-memory store for deterministic tests
process.env.DATABASE_URL = "";

let request;

beforeAll(async () => {
  // Dynamic import ensures env vars are evaluated before top-level await in the module
  const module = await import("../index.js");
  const app = module.default;
  request = supertest(app);
});

afterAll(() => {
  // No server to close since we conditionally skipped app.listen()
});

describe("GET /api/health", () => {
  it("returns 200 with status, mode, and timestamp", async () => {
    const response = await request.get("/api/health").expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.status).toBe("ok");
    expect(response.body.mode).toBe("memory");
    expect(response.body.timestamp).toBeDefined();
    expect(() => new Date(response.body.timestamp)).not.toThrow();
  });
});

describe("GET /api/places", () => {
  it("returns 200 with data array and meta", async () => {
    const response = await request.get("/api/places").expect(200);

    expect(response.body).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta).toBeDefined();
    expect(response.body.meta.source).toBe("memory");
    expect(typeof response.body.meta.count).toBe("number");
    expect(typeof response.body.meta.total).toBe("number");
  });

  it("filters results by search query q=Kopi", async () => {
    const response = await request.get("/api/places?q=Kopi").expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    // All returned places should contain "Kopi" in their name
    for (const place of response.body.data) {
      expect(place.name.toLowerCase()).toContain("kopi");
    }
    // Pending places (Kopi Kenangan MBK) should NOT appear
    for (const place of response.body.data) {
      expect(place.status).toBe("approved");
    }
  });

  it("filters results by category", async () => {
    const response = await request
      .get("/api/places?category=Cafe+%2F+Coffee+Shop")
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const place of response.body.data) {
      expect(place.category).toBe("Cafe / Coffee Shop");
      expect(place.status).toBe("approved");
    }
  });

  it("filters results by outlets=true", async () => {
    const response = await request.get("/api/places?outlets=true").expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const place of response.body.data) {
      expect(place.has_power_outlets).toBe(true);
    }
  });

  it("respects the limit parameter", async () => {
    const limit = 5;
    const response = await request
      .get(`/api/places?limit=${limit}`)
      .expect(200);

    expect(response.body.data.length).toBeLessThanOrEqual(limit);
  });

  it("respects the offset parameter", async () => {
    // Get first page
    const firstPage = await request.get("/api/places?offset=0&limit=2");
    // Get second page
    const secondPage = await request.get("/api/places?offset=2&limit=2");

    expect(firstPage.body.data.length).toBeGreaterThan(0);
    expect(secondPage.body.data.length).toBeGreaterThan(0);

    // Ensure no overlap between pages
    const firstPageIds = firstPage.body.data.map((p) => p.id);
    const secondPageIds = secondPage.body.data.map((p) => p.id);
    const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("handles invalid offset like -1 gracefully", async () => {
    const response = await request.get("/api/places?offset=-1").expect(200);

    // Should default offset to 0 and return places
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});

describe("GET /api/places/:id", () => {
  it("returns 200 with place data for a valid ID", async () => {
    const response = await request.get("/api/places/1").expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(1);
    expect(response.body.data.name).toBe("Kopi Janji Jiwa Kedaton");
    expect(response.body.data.category).toBe("Cafe / Coffee Shop");
    expect(response.body.meta).toBeDefined();
    expect(response.body.meta.source).toBe("memory");
  });

  it("returns 404 for a non-existent place ID", async () => {
    const response = await request.get("/api/places/999").expect(404);

    expect(response.body.error).toBe("Place not found");
  });
});

describe("POST /api/places", () => {
  it("returns 401 when no session is present", async () => {
    const response = await request.post("/api/places").send({}).expect(401);

    expect(response.body.error).toBeDefined();
  });
});

describe("POST /api/admin/login", () => {
  it("returns 200 and sets cookie with valid token", async () => {
    const response = await request
      .post("/api/admin/login")
      .send({ token: "test-admin-token" })
      .expect(200);

    expect(response.body.message).toBe("Admin session created");

    // Check that a set-cookie header is present
    const cookies = response.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const hasAdminSession = cookies.some((c) => c.startsWith("admin_session="));
    expect(hasAdminSession).toBe(true);
  });

  it("returns 401 with invalid token", async () => {
    const response = await request
      .post("/api/admin/login")
      .send({ token: "wrong-token" })
      .expect(401);

    expect(response.body.error).toBe("Invalid admin token");
  });
});

describe("GET /api/admin/submissions", () => {
  it("returns 401 when no auth is provided", async () => {
    const response = await request.get("/api/admin/submissions").expect(401);

    expect(response.body.error).toBe("Unauthorized");
  });

  it("returns submissions data when authenticated", async () => {
    // First login to get cookie
    const loginResponse = await request
      .post("/api/admin/login")
      .send({ token: "test-admin-token" });

    const cookies = loginResponse.headers["set-cookie"];

    // Then request submissions with the cookie
    const response = await request
      .get("/api/admin/submissions")
      .set("Cookie", cookies)
      .expect(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.stats).toBeDefined();
    expect(response.body.data.submissions).toBeDefined();
    expect(Array.isArray(response.body.data.submissions)).toBe(true);
  });
});
