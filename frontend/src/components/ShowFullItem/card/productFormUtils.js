export function capitalizeFirstLetter(value) {
  return value.replace(/^(\s*)(\p{L})/u, (_, whitespace, letter) =>
    `${whitespace}${letter.toLocaleUpperCase('ru-RU')}`,
  );
}

export function validateProductText(title, description) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (!trimmedTitle || !trimmedDescription) {
    return 'Заполните название и описание товара';
  }
  if ((trimmedTitle.match(/\p{L}/gu) || []).length < 3) {
    return 'Название товара должно содержать не менее 3 букв';
  }
  if (trimmedDescription.split(/\s+/).length < 3) {
    return 'Описание должно содержать не менее 3 слов';
  }
  return null;
}
