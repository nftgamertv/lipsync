import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CalibrationPanel from "@/components/CalibrationPanel";
import type { CalibrationState } from "@/types/viseme";

const defaultCalibration: CalibrationState = {
  mouthX: 0.5,
  mouthY: 0.7,
  mouthScale: 1.0,
  opacity: 1.0,
  displayScale: 1.0,
};

describe("CalibrationPanel component", () => {
  test("renders all slider labels", () => {
    const onChange = jest.fn();
    render(
      <CalibrationPanel calibration={defaultCalibration} onChange={onChange} />
    );

    expect(screen.getByText("Mouth X")).toBeInTheDocument();
    expect(screen.getByText("Mouth Y")).toBeInTheDocument();
    expect(screen.getByText("Mouth Scale")).toBeInTheDocument();
    expect(screen.getByText("Opacity")).toBeInTheDocument();
    expect(screen.getByText("Display Scale")).toBeInTheDocument();
  });

  test("renders 5 range inputs", () => {
    const onChange = jest.fn();
    render(
      <CalibrationPanel calibration={defaultCalibration} onChange={onChange} />
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(5);
  });

  test("sliders have correct initial values", () => {
    const onChange = jest.fn();
    render(
      <CalibrationPanel calibration={defaultCalibration} onChange={onChange} />
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders[0]).toHaveValue("0.5"); // mouthX
    expect(sliders[1]).toHaveValue("0.7"); // mouthY
    expect(sliders[2]).toHaveValue("1");   // mouthScale
    expect(sliders[3]).toHaveValue("1");   // opacity
    expect(sliders[4]).toHaveValue("1");   // displayScale
  });

  test("changing mouth X slider calls onChange", () => {
    const onChange = jest.fn();
    render(
      <CalibrationPanel calibration={defaultCalibration} onChange={onChange} />
    );

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "0.3" } });
    expect(onChange).toHaveBeenCalledWith({ mouthX: 0.3 });
  });

  test("changing mouth Y slider calls onChange", () => {
    const onChange = jest.fn();
    render(
      <CalibrationPanel calibration={defaultCalibration} onChange={onChange} />
    );

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[1], { target: { value: "0.6" } });
    expect(onChange).toHaveBeenCalledWith({ mouthY: 0.6 });
  });

  test("reset button resets to defaults", () => {
    const onChange = jest.fn();
    const custom: CalibrationState = {
      mouthX: 0.2,
      mouthY: 0.3,
      mouthScale: 2.0,
      opacity: 0.5,
      displayScale: 1.5,
    };
    render(<CalibrationPanel calibration={custom} onChange={onChange} />);

    fireEvent.click(screen.getByText("Reset"));
    expect(onChange).toHaveBeenCalledWith({
      mouthX: 0.5,
      mouthY: 0.7,
      mouthScale: 1.0,
      opacity: 1.0,
      displayScale: 1.0,
    });
  });

  test("renders section heading", () => {
    const onChange = jest.fn();
    render(
      <CalibrationPanel calibration={defaultCalibration} onChange={onChange} />
    );
    expect(screen.getByText("Calibration")).toBeInTheDocument();
  });
});
