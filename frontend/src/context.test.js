import { authentication } from "./context";

describe("authentication", () => {
    const originalFetch = global.fetch;
    const originalApiOrigin = process.env.REACT_APP_API_ORIGIN;

    beforeEach(() => {
        process.env.REACT_APP_API_ORIGIN = "https://api.example.test";
        process.env.NODE_ENV = "development";
    });

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalApiOrigin === undefined) {
            delete process.env.REACT_APP_API_ORIGIN;
        } else {
            process.env.REACT_APP_API_ORIGIN = originalApiOrigin;
        }
    });

    test("treats an unauthenticated /me response as a signed-out state", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            status: 401,
            ok: false
        });

        await expect(authentication()).resolves.toBeNull();
    });

    test("returns null without throwing for unexpected /me failures", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        global.fetch = jest.fn().mockResolvedValue({
            status: 503,
            ok: false
        });

        await expect(authentication()).resolves.toBeNull();
        expect(console.error).toHaveBeenCalledWith("Ошибка загрузки профиля:", 503);

        console.error.mockRestore();
    });
});
