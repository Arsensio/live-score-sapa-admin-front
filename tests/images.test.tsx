import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { uploadImage } from "../src/shared/api/images";
import { ImageUpload } from "../src/shared/ui/image-upload";
import { useImageUploads } from "../src/shared/ui/use-image-uploads";
import { TeamFormPage } from "../src/pages/team-form/ui";
import { teamApi } from "../src/entities/team/api";
import { validImageUrl } from "../src/shared/lib/validation";

vi.mock("../src/entities/team/api", () => ({ teamApi: { create: vi.fn() } }));
const photo = () =>
  new File(["image-content"], "photo.jpg", { type: "image/jpeg" });
const reply = (target = "team") =>
  new Response(
    JSON.stringify({
      suffix: `/image/${target}/test.jpg`,
      url: `http://localhost:8091/image/${target}/test.jpg`,
    }),
    { status: 200 },
  );
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function UploadForm() {
  const [value, setValue] = useState("");
  const uploads = useImageUploads();
  return (
    <>
      <ImageUpload
        label="Логотип команды"
        target="team"
        value={value}
        onChange={setValue}
        onStateChange={(s) => uploads.setUploadState("logo", s)}
      />
      <button disabled={uploads.blocked}>Сохранить</button>
      <output>{value}</output>
    </>
  );
}
describe("загрузка изображений", () => {
  it.each(["player", "team", "tournament"] as const)(
    "отправляет файл в multipart на /image/%s",
    async (target) => {
      const fetchMock = vi.fn().mockResolvedValue(reply(target));
      vi.stubGlobal("fetch", fetchMock);
      const file = photo();
      await expect(uploadImage(target, file)).resolves.toBe(
        `/image/${target}/test.jpg`,
      );
      const [url, options] = fetchMock.mock.calls[0];
      expect(url.pathname).toBe(`/image/${target}`);
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);
      expect(options.body.get("file")).toBe(file);
      expect(options.headers).not.toHaveProperty("Content-Type");
    },
  );
  it("не принимает ответ без адреса изображения", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(uploadImage("team", photo())).rejects.toThrow(
      "не вернул адрес",
    );
  });
  it("сохраняет backend-путь и отклоняет произвольные относительные пути", () => {
    expect(validImageUrl("/image/team/abc.jpg")).toBe(true);
    expect(validImageUrl("/some-page")).toBe(false);
    expect(validImageUrl("javascript:alert(1)")).toBe(false);
  });
  it("блокирует сохранение до загрузки и показывает предпросмотр", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const user = userEvent.setup();
    render(<UploadForm />);
    await user.upload(screen.getByLabelText("Логотип команды"), photo());
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("img")).toHaveProperty("src", "blob:preview");
    resolve(reply());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
    expect(screen.getByText("/image/team/test.jpg")).toBeTruthy();
  });
  it("позволяет повторить загрузку после ошибки", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(reply());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<UploadForm />);
    await user.upload(screen.getByLabelText("Логотип команды"), photo());
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty(
      "disabled",
      true,
    );
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await screen.findByText("/image/team/test.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("отмена прерывает запрос и освобождает сохранение", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const rendered = render(<UploadForm />);
    await user.upload(screen.getByLabelText("Логотип команды"), photo());
    const signal = (
      fetchMock.mock.calls as unknown as [URL, RequestInit][]
    )[0][1].signal;
    await user.click(screen.getByRole("button", { name: "Отменить загрузку" }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty(
      "disabled",
      false,
    );
    rendered.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
  it("передаёт логотип и фото игрока в JSON создания команды", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        reply(url.pathname.endsWith("player") ? "player" : "team"),
      ),
    );
    vi.mocked(teamApi.create).mockResolvedValue({ id: "team" } as never);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tournaments/cup/teams/new"]}>
        <Routes>
          <Route
            path="/tournaments/:tournamentId/teams/new"
            element={<TeamFormPage />}
          />
          <Route
            path="/tournaments/cup/teams"
            element={<p>Команда сохранена</p>}
          />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Название команды *"), "Team");
    await user.upload(screen.getByLabelText("Логотип команды"), photo());
    await screen.findByText("Изображение загружено");
    await user.click(screen.getByRole("button", { name: "Добавить игрока" }));
    await user.type(screen.getByLabelText("Имя *"), "Arman");
    await user.type(screen.getByLabelText("Фамилия *"), "Aliyev");
    await user.type(screen.getByLabelText("Номер футболки"), "10");
    await user.upload(screen.getByLabelText("Фото игрока 1"), photo());
    await waitFor(() =>
      expect(screen.getAllByText("Изображение загружено")).toHaveLength(2),
    );
    await user.click(screen.getByRole("button", { name: "Сохранить команду" }));
    await waitFor(() =>
      expect(teamApi.create).toHaveBeenCalledWith({
        tournamentId: "cup",
        name: "Team",
        shortName: null,
        logoUrl: "/image/team/test.jpg",
        players: [
          {
            firstName: "Arman",
            lastName: "Aliyev",
            shirtNumber: 10,
            photoUrl: "/image/player/test.jpg",
          },
        ],
      }),
    );
    await screen.findByText("Команда сохранена");
  });
});
