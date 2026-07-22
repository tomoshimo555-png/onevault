import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("creates a folder from the new-folder button", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "新規フォルダ" }));
    const dialog = await screen.findByRole("dialog", { name: "新規フォルダ" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "フォルダ名" }), { target: { value: "資料" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "作成" }));

    expect(await screen.findByRole("button", { name: "資料" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "新規フォルダ" })).not.toBeInTheDocument();
  });
});
