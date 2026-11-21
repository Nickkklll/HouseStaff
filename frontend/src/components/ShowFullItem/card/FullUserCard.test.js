import React from "react";
import { render } from "@testing-library/react";
import { AppContext } from "../../../context";
import FullUserCard from "./FullUserCard";

function renderCard(item, user) {
  return render(
    <AppContext.Provider value={{ getCsrfToken: jest.fn(), user, loading: false }}>
      <FullUserCard item={item} onAdd={jest.fn()} />
    </AppContext.Provider>
  );
}

describe("FullUserCard review rating", () => {
  const baseItem = {
    id: "product-1",
    img: "/test-product.webp",
    title: "Товар",
    desc: "",
    price: 10,
  };

  test("shows zero when there are no reviews", () => {
    const { container } = renderCard({ ...baseItem, reviews: [] });

    expect(container.querySelector(".review-stars__full").textContent).toBe(
      "★0/5"
    );
  });

  test("shows zero when reviews are missing", () => {
    const { container } = renderCard(baseItem);

    expect(container.querySelector(".review-stars__full").textContent).toBe(
      "★0/5"
    );
  });

  test("calculates the average for existing reviews", () => {
    const { container } = renderCard({
      ...baseItem,
      reviews: [{ id: "review-1", rating: 5 }, { id: "review-2", rating: 3 }],
    });

    expect(container.querySelector(".review-stars__full").textContent).toBe(
      "★4/5"
    );
  });

  test("does not show the add-to-cart button to sellers", () => {
    const { container } = renderCard(
      { ...baseItem, reviews: [] },
      { role: "seller" }
    );

    expect(container.querySelector(".add-to-cart")).toBeNull();
  });
});
