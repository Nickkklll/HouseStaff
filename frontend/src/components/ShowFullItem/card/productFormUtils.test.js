import { capitalizeFirstLetter, validateProductText } from './productFormUtils';

test('capitalizes the first letter after leading whitespace', () => {
  expect(capitalizeFirstLetter('  новый товар')).toBe('  Новый товар');
});

test('requires at least three letters in the title', () => {
  expect(validateProductText('ab', 'одно два три')).toBe(
    'Название товара должно содержать не менее 3 букв',
  );
  expect(validateProductText('а-б-в', 'одно два три')).toBeNull();
});

test('requires at least three words in the description', () => {
  expect(validateProductText('Стол', 'одно два')).toBe(
    'Описание должно содержать не менее 3 слов',
  );
  expect(validateProductText('Стол', 'одно два три')).toBeNull();
});
