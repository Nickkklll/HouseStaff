import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { AppContext } from "../context";
import Item from "./Item";

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/" }),
}));

function renderItem(user) {
  return render(
    <AppContext.Provider
      value={{
        addToFavorites: jest.fn(),
        delFromFavorites: jest.fn(),
        loading: false,
        user,
      }}
    >
      <Item
        item={{ id: "product-1", img: "/test-product.webp", title: "Товар", desc: "", price: 10 }}
        isFav={false}
        setIsFullItemModalOpen={jest.fn()}
        setSelectItem={jest.fn()}
        onAdd={jest.fn()}
      />
    </AppContext.Provider>
  );
}

describe("Item add-to-cart button", () => {
  test("does not show the button to sellers", () => {
    const { container } = renderItem({ role: "seller" });

    expect(container.querySelector(".product-card__add")).toBeNull();
  });

  test("shows the button to non-seller users", () => {
    const { container } = renderItem({ role: "user" });

    expect(container.querySelector(".product-card__add")).not.toBeNull();
  });

  test("shows an image fallback when the product image is missing", () => {
    const { container } = renderItem({ role: "user" });
    const image = container.querySelector(".product-card__image");

    fireEvent.error(image);

    expect(image.getAttribute("src")).toContain("/uploads/img/system/Image-placeholder.jpg");
  });
});
