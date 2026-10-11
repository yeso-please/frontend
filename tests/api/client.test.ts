// 실제 서버 모드(USE_MOCK=false)의 클라이언트 동작: 401이면 refresh를 한 번만 하고 원래 요청을 다시 보냅니다.
jest.mock("@/api/config", () => ({ API_BASE_URL: "http://test.local/api", USE_MOCK: false, REQUEST_TIMEOUT_MS: 2000, LINK_BASE_URL: "tripin://" }));

import { request } from "@/api/client";
import { ApiError, NetworkError } from "@/api/errors";
import { useAuthStore } from "@/store/auth";

type Call = { url: string; init: RequestInit };

const json = (status: number, body: unknown) => ({ status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
const authResponse = (token: string) => ({
  user: { id: 1, email: "a@b.c", nickname: "테스터", profileImage: null },
  accessToken: token,
  tokenType: "Bearer",
  expiresInSeconds: 1800,
  onboardingCompleted: true,
});
const unauthenticated = { status: 401, code: "AUTH_UNAUTHENTICATED", message: "로그인이 필요합니다." };

let calls: Call[];

beforeEach(() => {
  calls = [];
  useAuthStore.setState({ status: "signedIn", accessToken: "old-token", user: null, onboardingCompleted: true });
});

function mockFetch(handler: (url: string, init: RequestInit) => ReturnType<typeof json> | Promise<ReturnType<typeof json>>) {
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {}) as unknown as Response;
  }) as typeof fetch;
}

it("Authorization 헤더와 credentials: include로 보냅니다", async () => {
  mockFetch(() => json(200, { ok: true }));
  await request("GET", "/users/me");
  expect(calls[0].url).toBe("http://test.local/api/users/me");
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer old-token");
  expect(calls[0].init.credentials).toBe("include");
});

it("동시에 401이 나도 refresh는 한 번만 부르고 두 요청 모두 새 토큰으로 재시도합니다", async () => {
  let refreshCount = 0;
  mockFetch(async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCount += 1;
      await new Promise((r) => setTimeout(r, 20));
      return json(200, authResponse("new-token"));
    }
    const auth = (init.headers as Record<string, string>).Authorization;
    return auth === "Bearer new-token" ? json(200, { url }) : json(401, unauthenticated);
  });

  const [a, b] = await Promise.all([request<{ url: string }>("GET", "/trips"), request<{ url: string }>("GET", "/friends")]);
  expect(refreshCount).toBe(1);
  expect(a.url).toMatch(/\/trips$/);
  expect(b.url).toMatch(/\/friends$/);
  expect(useAuthStore.getState().accessToken).toBe("new-token");
});

it("refresh도 실패하면 로그아웃 상태가 됩니다", async () => {
  mockFetch((url) => (url.endsWith("/auth/refresh") ? json(401, { status: 401, code: "AUTH_INVALID_REFRESH_TOKEN", message: "다시 로그인" }) : json(401, unauthenticated)));
  await expect(request("GET", "/trips")).rejects.toMatchObject({ code: "AUTH_INVALID_REFRESH_TOKEN" });
  expect(useAuthStore.getState().status).toBe("signedOut");
});

it("오류는 code·fieldErrors·details를 담은 ApiError로 던집니다", async () => {
  mockFetch(() =>
    json(409, { status: 409, code: "TRIP_DATE_OVERLAP", message: "겹쳐요", details: { conflicts: [{ tripId: 1 }] }, fieldErrors: [{ field: "startDate", message: "필수" }] }),
  );
  const err = (await request("POST", "/trips", { body: {} }).catch((e: unknown) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.code).toBe("TRIP_DATE_OVERLAP");
  expect(err.fieldMessage("startDate")).toBe("필수");
  expect(err.details.conflicts).toHaveLength(1);
});

it("쿼리 문자열에서 null·undefined 값은 뺍니다", async () => {
  mockFetch(() => json(200, []));
  await request("GET", "/regions", { query: { days: 3, scheduleDensity: undefined, x: null } });
  expect(calls[0].url).toBe("http://test.local/api/regions?days=3");
});

it("네트워크가 끊기면 NetworkError", async () => {
  global.fetch = jest.fn(async () => {
    throw new TypeError("Network request failed");
  }) as typeof fetch;
  await expect(request("GET", "/trips")).rejects.toBeInstanceOf(NetworkError);
});
