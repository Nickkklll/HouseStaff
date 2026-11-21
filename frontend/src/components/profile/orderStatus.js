export function getOrderStatusClass(status) {
  if (typeof status !== "string") return "";
  if (status.includes("Ожидает") || status === "В обработке") return "status-grey";
  if (status === "Обработано") return "status-green";
  return "";
}
