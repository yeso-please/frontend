import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { SentLinkList } from "@/features/share/SentLinkList";

// 보낸 링크 목록: 사용 중인 링크만 취소할 수 있고, 지난(만료·취소) 링크는 접어 둡니다.
const future = "2099-01-01T00:00:00";
const past = "2000-01-01T00:00:00";
const links = [
  { id: 1, expiresAt: future, revoked: false, createdAt: "2026-10-22T09:00:00", acceptedCount: 2 },
  { id: 2, expiresAt: past, revoked: false, createdAt: "2026-10-01T09:00:00", acceptedCount: 0 },
  { id: 3, expiresAt: future, revoked: true, createdAt: "2026-10-20T09:00:00", acceptedCount: 0 },
];

describe("SentLinkList", () => {
  it("사용 중인 링크에만 취소 버튼이 있고, 확인하면 그 링크를 넘긴다", async () => {
    const onRevoke = jest.fn();
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === "destructive")?.onPress?.());
    await render(<SentLinkList links={links} detail={(l) => `${l.acceptedCount}명`} revokeMessage="설명" onRevoke={onRevoke} revokingId={null} />);

    expect(screen.getAllByRole("button", { name: "링크 취소" })).toHaveLength(1);
    expect(screen.getByText("2명")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "링크 취소" }));
    expect(alert).toHaveBeenCalledWith("이 링크를 취소할까요?", "설명", expect.any(Array));
    expect(onRevoke).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    alert.mockRestore();
  });

  it("지난 링크는 접어 두고 눌러서 펼친다", async () => {
    await render(<SentLinkList links={links} revokeMessage="설명" onRevoke={jest.fn()} revokingId={null} />);
    expect(screen.queryByText("취소됨")).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "지난 링크 2개 보기" }));
    expect(screen.getByText("취소됨")).toBeOnTheScreen();
    expect(screen.getByText("만료")).toBeOnTheScreen();
  });

  it("사용 중인 링크가 없으면 알려 준다", async () => {
    await render(<SentLinkList links={[links[1]]} revokeMessage="설명" onRevoke={jest.fn()} revokingId={null} />);
    expect(screen.getByText("사용 중인 링크가 없어요.")).toBeOnTheScreen();
  });
});
