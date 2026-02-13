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

  test("typing text does NOT call onTextSubmit", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i);
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("pressing Enter submits the text", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i);
    fireEvent.change(textarea, { target: { value: "hello world" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("hello world");
  });

  test("Shift+Enter does NOT submit", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i);
    fireEvent.change(textarea, { target: { value: "test" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("Send Text button submits the text", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i);
    fireEvent.change(textarea, { target: { value: "button test" } });
    fireEvent.click(screen.getByText("Send Text"));
    expect(onSubmit).toHaveBeenCalledWith("button test");
  });

  test("textarea value updates on typing", () => {
    const onSubmit = jest.fn();
    render(<TextInput onTextSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText(/type or paste text/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "test" } });
    expect(textarea.value).toBe("test");
  });
});
