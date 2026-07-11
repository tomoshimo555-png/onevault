import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("OneVault shell", () => {
  it("renders the desktop workspace from the design reference", async () => {
    render(<App />);
    expect(await screen.findByText("OneVault")).toBeInTheDocument();
    expect(screen.getAllByText("人生のボトルネック改善").length).toBeGreaterThan(0);
    expect(screen.getByText("AppFolder")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Markdown editor" })).toBeInTheDocument();
  });
});
