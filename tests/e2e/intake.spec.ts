import { expect, test } from "@playwright/test";
import sharp from "sharp";

async function inspectionImage() {
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 88, g: 92, b: 91 }
    }
  }).png().toBuffer();
}

async function prepareVisualOnlyAudit(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Structure name").fill("KAVACH E2E demo pier");
  await page.locator("#inspection-image").setInputFiles({
    name: "inspection.png",
    mimeType: "image/png",
    buffer: await inspectionImage()
  });
}

test("intake exposes camera capture and safe visual-only defaults on mobile", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Start a structural audit" })).toBeVisible();
  await expect(page.locator("#camera-image")).toHaveAttribute("capture", "environment");
  await expect(page.getByText("Uncalibrated visual triage")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public structure evidence" })).toBeVisible();
});

test("demo audit renders a completed evidence-bound report", async ({ page }) => {
  await prepareVisualOnlyAudit(page);
  await page.getByRole("button", { name: "Run structural audit" }).click();

  await expect(page.getByText("Visual risk triage index")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("heading", { name: "Bilingual audit report" })).toBeVisible();
  await expect(page.getByText("This result is uncalibrated visual triage.")).toBeVisible();
});

test("offline consent queues an audit instead of losing the image", async ({ page, context }) => {
  await prepareVisualOnlyAudit(page);
  await page.getByRole("checkbox").check();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Run structural audit" }).click();

  await expect(page.getByText("Held safely in local queue")).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 audit waiting on this device" })).toBeVisible();
});
