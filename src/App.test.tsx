import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(cleanup);

describe("OneVault shell", () => {
  it("renders the desktop workspace from the design reference", async () => {
    render(<App />);
    expect(await screen.findByText("OneVault")).toBeInTheDocument();
    expect(screen.getAllByText("人生のボトルネック改善").length).toBeGreaterThan(0);
    expect(screen.getByText("AppFolder")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Markdown editor" })).toBeInTheDocument();
  });

  it("creates and opens an untitled file from the new-file button", async () => {
    render(<App />);

    const [newFileButton] = await screen.findAllByRole("button", { name: "新規ファイル" });
    fireEvent.click(newFileButton);

    expect(screen.getAllByText("無題").length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "Markdown editor" })).toHaveTextContent("# 無題");
  });
});
