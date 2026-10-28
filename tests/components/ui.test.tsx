import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { Button, SelectableChip } from "@/components/ui";
import { SegmentedTabs } from "@/features/course/components/SegmentedTabs";

// 여러 화면이 함께 쓰는 버튼·태그·세그먼트를 접근성 역할(button·checkbox·tab)로 찾아 눌러 봅니다.

describe("Button", () => {
  it("누르면 onPress를 부른다", async () => {
    const onPress = jest.fn();
    await render(<Button label="발행하기" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "발행하기" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("비활성이면 눌러도 부르지 않고 disabled로 알린다", async () => {
    const onPress = jest.fn();
    await render(<Button label="저장" onPress={onPress} disabled />);
    const button = screen.getByRole("button", { name: "저장" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("처리 중이면 busy로 알리고 다시 누를 수 없다", async () => {
    const onPress = jest.fn();
    await render(<Button label="여행기 쓰기" onPress={onPress} loading />);
    const button = screen.getByRole("button", { name: "여행기 쓰기" });
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("SelectableChip", () => {
  function TagPicker() {
    const [tags, setTags] = useState<string[]>([]);
    const toggle = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    return (
      <>
        {["골목", "카페"].map((t) => (
          <SelectableChip key={t} label={t} selected={tags.includes(t)} onPress={() => toggle(t)} />
        ))}
      </>
    );
  }

  it("누를 때마다 선택 상태가 checked로 바뀐다", async () => {
    await render(<TagPicker />);
    const chip = screen.getByRole("checkbox", { name: "골목" });
    expect(chip).not.toBeChecked();

    await fireEvent.press(chip);
    expect(screen.getByRole("checkbox", { name: "골목" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "카페" })).not.toBeChecked();

    await fireEvent.press(screen.getByRole("checkbox", { name: "골목" }));
    expect(screen.getByRole("checkbox", { name: "골목" })).not.toBeChecked();
  });
});

describe("SegmentedTabs", () => {
  const options = [
    { value: "PRIVATE", label: "나만" },
    { value: "FRIENDS", label: "친구" },
    { value: "LINK", label: "링크" },
  ] as const;

  it("고른 칸만 selected이고, 다른 칸을 누르면 그 값을 넘긴다", async () => {
    const onChange = jest.fn();
    await render(<SegmentedTabs options={[...options]} value="PRIVATE" onChange={onChange} accessibilityLabel="공개 범위" />);

    expect(screen.getByRole("tab", { name: "나만" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "친구" })).not.toBeSelected();

    await fireEvent.press(screen.getByRole("tab", { name: "친구" }));
    expect(onChange).toHaveBeenCalledWith("FRIENDS");
  });
});
