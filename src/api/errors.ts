import type { ApiErrorBody } from "./types";

/** 백엔드 공통 오류 응답. 화면 분기는 status가 아니라 code로 합니다. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: NonNullable<ApiErrorBody["fieldErrors"]>;
  readonly details: Record<string, unknown>;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = body.status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors ?? [];
    this.details = body.details ?? {};
  }

  /** 특정 필드의 검증 메시지 (폼 옆에 표시) */
  fieldMessage(field: string) {
    return this.fieldErrors.find((e) => e.field === field)?.message;
  }
}

export const isApiError = (e: unknown, code?: string): e is ApiError => e instanceof ApiError && (code === undefined || e.code === code);

/** 네트워크 자체가 실패했을 때 (서버 꺼짐, 오프라인, 타임아웃) */
export class NetworkError extends Error {
  constructor(message = "서버에 연결할 수 없어요. 네트워크를 확인해 주세요.") {
    super(message);
    this.name = "NetworkError";
  }
}

/** 사용자에게 보여줄 한 줄 메시지 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError || e instanceof NetworkError) return e.message;
  return "잠시 후 다시 시도해 주세요.";
}
