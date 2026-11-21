import { getOrderStatusClass } from "./orderStatus";

describe("getOrderStatusClass", () => {
  test.each(["Ожидает", "Ожидает обработки", "В обработке"])(
    "uses the waiting style for %s",
    (status) => {
      expect(getOrderStatusClass(status)).toBe("status-grey");
    }
  );

  test("uses the completed style for processed orders", () => {
    expect(getOrderStatusClass("Обработано")).toBe("status-green");
  });

  test("does not style unknown statuses", () => {
    expect(getOrderStatusClass("Собирается")).toBe("");
  });
});
