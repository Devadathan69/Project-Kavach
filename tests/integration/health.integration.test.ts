import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/health/route";

describe("health endpoint", () => {
  it("returns the KAVACH service heartbeat", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ service: "kavach", status: "ok" });
  });
});
