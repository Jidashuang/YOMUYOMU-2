import { expect, test } from "@playwright/test";

test.describe("vocab review behavior", () => {
  const API_BASE = "http://localhost:8000";
  const userId = "33333333-3333-4333-8333-333333333333";
  const dueId = "55555555-5555-4555-8555-555555555555";
  const newId = "66666666-6666-4666-8666-666666666666";
  const knownId = "77777777-7777-4777-8777-777777777777";

  function makeItem(overrides: Record<string, unknown>) {
    return {
      id: dueId,
      surface: "来る",
      lemma: "来る",
      reading: "くる",
      pos: "verb",
      meaning_snapshot: { meanings: ["来", "到来"] },
      jlpt_level: "N5",
      frequency_band: "top-1k",
      source_article_id: null,
      source_sentence: "彼は来るはずだったのに。",
      status: "learning",
      next_review_at: new Date(Date.now() - 60_000).toISOString(),
      review_count: 1,
      created_at: "2026-03-17T00:00:00Z",
      ...overrides,
    };
  }

  test("review pass / fail and status changes invalidate buckets", async ({ page }) => {
    let dueItem = makeItem({});
    const newItem = makeItem({
      id: newId,
      surface: "はず",
      lemma: "はず",
      reading: "はず",
      meaning_snapshot: { meanings: ["按理；预期"] },
      status: "new",
      next_review_at: null,
      review_count: 0,
    });
    const knownItem = makeItem({
      id: knownId,
      surface: "彼",
      lemma: "彼",
      reading: "かれ",
      meaning_snapshot: { meanings: ["他"] },
      status: "known",
      next_review_at: null,
      review_count: 4,
    });

    let lastReviewResult: string | null = null;

    await page.route(`${API_BASE}/**`, async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());

      if (method === "POST" && url.pathname === "/auth/login") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "e2e-token",
            token_type: "bearer",
            user: { id: userId, email: "vocab@example.com" },
          }),
        });
      }

      if (method === "GET" && url.pathname === "/analytics/today") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            date: "2026-03-17",
            lookup_count: 4,
            vocab_added_count: 2,
            ai_explanation_count: 1,
          }),
        });
      }

      if (method === "GET" && url.pathname === "/vocab") {
        const bucket = url.searchParams.get("bucket");
        if (bucket === "review_due") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([dueItem]) });
        }
        if (bucket === "today_new") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([newItem]) });
        }
        if (bucket === "unmastered") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([dueItem, newItem]) });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([dueItem, newItem, knownItem]),
        });
      }

      if (method === "PATCH" && url.pathname === `/vocab/${dueId}/review`) {
        const body = JSON.parse(request.postData() ?? "{}") as { result: "fail" | "pass" };
        lastReviewResult = body.result;
        const updated = makeItem({
          status: body.result === "pass" ? "learning" : "learning",
          review_count: body.result === "pass" ? 2 : 0,
          next_review_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
        dueItem = updated;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
      }

      if (method === "PATCH" && url.pathname === `/vocab/${newId}/status`) {
        const body = JSON.parse(request.postData() ?? "{}") as { status: "new" | "learning" | "known" };
        const updated = { ...newItem, status: body.status };
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
      }

      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: `Unhandled mock: ${method} ${url.pathname}` }),
      });
    });

    await page.goto("/login");
    await page.getByTestId("login-email").fill("vocab@example.com");
    await page.getByTestId("login-password").fill("password123");
    await page.getByTestId("login-submit").click();

    await page.goto("/vocab");

    // 到期复习 is the primary section.
    const dueSection = page.getByTestId("vocab-due-section");
    await expect(dueSection).toBeVisible();
    await expect(dueSection).toContainText("到期复习");
    await expect(page.getByTestId("vocab-due-count")).toHaveText("1");

    // Status badges use Chinese-friendly labels.
    await expect(dueSection.getByTestId("vocab-card-status").first()).toHaveText("学习中");

    // No raw "review_count" / "next_review" / "lemma:" / "pos:" text leaks.
    await expect(page.locator("body")).not.toContainText("review_count");
    await expect(page.locator("body")).not.toContainText("next_review:");
    await expect(page.locator("body")).not.toContainText("lemma:");
    await expect(page.locator("body")).not.toContainText("pos:");

    // Review pass invalidates queries; mock returns updated row.
    await dueSection.getByTestId("vocab-review-pass").first().click();
    await expect.poll(() => lastReviewResult).toBe("pass");

    // Review fail still works.
    await dueSection.getByTestId("vocab-review-fail").first().click();
    await expect.poll(() => lastReviewResult).toBe("fail");
  });
});
