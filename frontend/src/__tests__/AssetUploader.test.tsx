import React from "react";
import { render, screen } from "@testing-library/react";
import AssetUploader from "@/components/AssetUploader";
import { VISEME_LABELS } from "@/types/viseme";

describe("AssetUploader component", () => {
  test("renders section heading", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );
    expect(screen.getByText("Character Assets")).toBeInTheDocument();
  });

  test("renders base image upload", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );
    expect(screen.getByText("Base Face Image")).toBeInTheDocument();
  });

  test("renders viseme upload", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );
    expect(screen.getByText("Viseme Mouth Images")).toBeInTheDocument();
  });

  test("displays loaded count", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={5}
      />
    );
    expect(screen.getByText("5/12 visemes loaded")).toBeInTheDocument();
  });

  test("displays 0/12 when no visemes loaded", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );
    expect(screen.getByText("0/12 visemes loaded")).toBeInTheDocument();
  });

  test("renders all 12 viseme label chips", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );

    for (const label of VISEME_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  test("has two file inputs", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );

    // One for base, one for visemes
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs).toHaveLength(2);
  });

  test("viseme input accepts multiple files", () => {
    render(
      <AssetUploader
        onBaseImageLoad={jest.fn()}
        onVisemeImageLoad={jest.fn()}
        loadedVisemeCount={0}
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Second input should have 'multiple' attribute
    expect(fileInputs[1]).toHaveAttribute("multiple");
  });
});
