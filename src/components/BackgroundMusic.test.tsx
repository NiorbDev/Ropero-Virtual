import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BackgroundMusic } from "./BackgroundMusic";

it("starts on opening, continues across tabs, and can be paused", async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const random = vi.spyOn(Math, "random").mockReturnValue(.55);
  try {
    const { container, rerender } = render(<BackgroundMusic visible />);
    const player = container.querySelector("audio")!;
    vi.spyOn(player, "paused", "get").mockReturnValue(false);
    expect(player.loop).toBe(true);
    expect(player.getAttribute("src")).toMatch(/\/morning\.mp3$/);
    expect(play).toHaveBeenCalledOnce();
    fireEvent.playing(player);
    random.mockReturnValue(.85);
    rerender(<BackgroundMusic visible={false} />);
    expect(player.getAttribute("src")).toMatch(/\/morning\.mp3$/);
    expect(container.querySelector("audio")).toBe(player);
    expect(pause).not.toHaveBeenCalled();
    rerender(<BackgroundMusic visible />);
    const pauseButton = await screen.findByRole("button", { name: "Pausar música" });
    await vi.waitFor(() => expect(pauseButton).toBeEnabled());
    vi.spyOn(player, "paused", "get").mockReturnValue(false);
    fireEvent.click(pauseButton);
    expect(pause).toHaveBeenCalledOnce();
  } finally {
    vi.restoreAllMocks();
  }
});

it("retries at the first touch if autoplay was blocked", async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play")
    .mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError"))
    .mockResolvedValue();
  try {
    render(<BackgroundMusic visible={false} />);
    expect(play).toHaveBeenCalledOnce();
    fireEvent.click(document.body);
    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.click(document.body);
    expect(play).toHaveBeenCalledTimes(2);
  } finally {
    play.mockRestore();
  }
});