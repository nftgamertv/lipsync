import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import VisemeTester from "@/components/VisemeTester";
import { VISEME_LABELS } from "@/types/viseme";

describe("VisemeTester component", () => {
  test("renders all 12 viseme buttons", () => {
    const onTest = jest.fn();
    render(<VisemeTester activeViseme={0} onTestViseme={onTest} />);

    for (const label of VISEME_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  test("clicking a button calls onTestViseme with correct index", () => {
    const onTest = jest.fn();
    render(<VisemeTester activeViseme={0} onTestViseme={onTest} />);

    fireEvent.click(screen.getByText("Aa"));
    expect(onTest).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText("Oh"));
    expect(onTest).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByText("W-Oo"));
    expect(onTest).toHaveBeenCalledWith(11);
  });

  test("active viseme button has distinct styling", () => {
    const onTest = jest.fn();
    const { rerender } = render(
      <VisemeTester activeViseme={3} onTestViseme={onTest} />
    );

    const eeButton = screen.getByText("Ee");
    expect(eeButton.className).toContain("bg-indigo-600");

    // Other buttons should not have active styling
    const neutralButton = screen.getByText("Neutral");
    expect(neutralButton.className).not.toContain("bg-indigo-600");
  });

  test("renders heading", () => {
    const onTest = jest.fn();
    render(<VisemeTester activeViseme={0} onTestViseme={onTest} />);
    expect(screen.getByText("Viseme Tester")).toBeInTheDocument();
  });
});
