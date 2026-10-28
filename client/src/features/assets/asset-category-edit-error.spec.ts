import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { assetCategoryEditError } from "./asset-category-edit-error";

describe("asset category edit errors", () => {
  it("keeps a stale-version conflict actionable without resubmitting", () => {
    const error = new AxiosError("Conflict");
    error.response = { status: 409 } as AxiosError["response"];

    expect(assetCategoryEditError(error)).toEqual({
      conflict: true,
      requiresReview: false,
      message: expect.stringMatching(
        /draft is kept.*Load the latest category.*Nothing has been resubmitted/,
      ),
    });
  });

  it.each([
    ["network failure", new AxiosError("Network error")],
    [
      "server failure",
      Object.assign(new AxiosError("Server error"), {
        response: { status: 500 } as AxiosError["response"],
      }),
    ],
  ])("requires a state review after an unknown %s", (_kind, error) => {
    expect(assetCategoryEditError(error)).toEqual({
      conflict: false,
      requiresReview: true,
      message: expect.stringMatching(
        /outcome is unknown.*draft is kept.*before retrying/,
      ),
    });
  });

  it("uses the standard safe error message for known rejections", () => {
    const error = new AxiosError("Validation failed");
    error.response = {
      status: 400,
      data: { detail: "Invalid category" },
    } as AxiosError["response"];

    expect(assetCategoryEditError(error)).toEqual({
      conflict: false,
      requiresReview: false,
      message: "Invalid category",
    });
  });
});
