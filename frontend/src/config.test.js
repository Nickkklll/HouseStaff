describe("backend URL helpers", () => {
  const originalApiOrigin = process.env.REACT_APP_API_ORIGIN;

  afterEach(() => {
    if (originalApiOrigin === undefined) {
      delete process.env.REACT_APP_API_ORIGIN;
    } else {
      process.env.REACT_APP_API_ORIGIN = originalApiOrigin;
    }
  });

  test("uses the configured backend origin for API URLs", () => {
    process.env.REACT_APP_API_ORIGIN = "https://api.example.test/";

    jest.isolateModules(() => {
      const { apiUrl } = require("./config");
      expect(apiUrl("/orders?limit=5")).toBe(
        "https://api.example.test/orders?limit=5"
      );
    });
  });

  test("retargets saved absolute image URLs to the configured backend", () => {
    process.env.REACT_APP_API_ORIGIN = "https://api.example.test";

    jest.isolateModules(() => {
      const { assetUrl } = require("./config");
      expect(assetUrl("http://localhost:3000/uploads/img/product/chair.webp")).toBe(
        "https://api.example.test/uploads/img/product/chair.webp"
      );
      expect(assetUrl("/uploads/img/product/table.webp")).toBe(
        "https://api.example.test/uploads/img/product/table.webp"
      );
    });
  });

  test("preserves temporary image preview URLs", () => {
    process.env.REACT_APP_API_ORIGIN = "https://api.example.test";

    jest.isolateModules(() => {
      const { assetUrl } = require("./config");
      expect(assetUrl("blob:http://localhost:3001/preview")).toBe(
        "blob:http://localhost:3001/preview"
      );
    });
  });

  test("preserves images hosted outside the backend", () => {
    process.env.REACT_APP_API_ORIGIN = "https://api.example.test";

    jest.isolateModules(() => {
      const { assetUrl } = require("./config");
      expect(
        assetUrl(
          "https://project.supabase.co/storage/v1/object/public/product-images/chair.webp"
        )
      ).toBe(
        "https://project.supabase.co/storage/v1/object/public/product-images/chair.webp"
      );
    });
  });
});
