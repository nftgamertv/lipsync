import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TextInput from "@/components/TextInput";

describe("TextInput component", () => {
  test("renders textarea", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);
    expect(screen.getByPlaceholderText(/type or paste text/i)).toBeInTheDocument();
  });

  test("renders heading", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);
    expect(screen.getByText("Text Input")).toBeInTheDocument();
  });

  test("typing text calls onTextSubmit with each change", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i);
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(onSubmit).toHaveBeenCalledWith("hello");

    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(onSubmit).toHaveBeenCalledWith("hello world");
  });

  test("textarea value updates on typing", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "test" } });
    expect(textarea.value).toBe("test");
  });
});
