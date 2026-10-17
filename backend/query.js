const META_KEYS = new Set(['_sort', '_order', '_limit', '_page', '_start', '_end', '_fields', 'q']);
const OPERATOR_PATTERN = /^(.*)_(eq|ne|gt|gte|lt|lte|between|contains|exists|in|nin|like)$/;

function asList(value) {
    return Array.isArray(value) ? value : [value];
}

function getValuesAtPath(value, path) {
    if (Array.isArray(value)) return value.flatMap((item) => getValuesAtPath(item, path));
    if (path.length === 0) return [value];
    if (value === null || typeof value !== 'object') return [];
    return getValuesAtPath(value[path[0]], path.slice(1));
}

function comparable(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return Number(value);
    if (typeof value !== 'string') return value;
    if (value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) {
        const timestamp = Date.parse(value);
        if (Number.isFinite(timestamp)) return timestamp;
    }
    return value.toLocaleLowerCase();
}

function compareValues(left, right) {
    if (left === undefined || left === null) return right == null ? 0 : 1;
    if (right === undefined || right === null) return -1;
    const comparableLeft = comparable(left);
    const comparableRight = comparable(right);
    if (typeof comparableLeft === 'number' && typeof comparableRight === 'number') {
        return comparableLeft - comparableRight;
    }
    return String(comparableLeft).localeCompare(String(comparableRight), undefined, { numeric: true });
}

function matchesOperator(values, operator, expectedValues) {
    if (operator === 'exists') {
        const expected = ['true', '1', 'yes'].includes(String(expectedValues[0]).toLowerCase());
        return (values.length > 0) === expected;
    }

    if (operator === 'between') {
        const bounds = expectedValues.flatMap((value) => String(value).split(',')).slice(0, 2);
        return bounds.length === 2 && values.some((value) =>
            compareValues(value, bounds[0]) >= 0 && compareValues(value, bounds[1]) <= 0);
    }

    const listValues = ['in', 'nin'].includes(operator)
        ? expectedValues.flatMap((value) => String(value).split(','))
        : expectedValues;

    if (operator === 'nin') {
        return values.length > 0 && values.every((value) => !listValues.includes(String(value)));
    }

    return values.some((value) => expectedValues.some((expected) => {
        if (value === undefined || value === null) return false;
        const actual = String(value);
        const wanted = String(expected);
        switch (operator) {
            case 'eq': return actual === wanted;
            case 'ne': return actual !== wanted;
            case 'gt': return compareValues(value, expected) > 0;
            case 'gte': return compareValues(value, expected) >= 0;
            case 'lt': return compareValues(value, expected) < 0;
            case 'lte': return compareValues(value, expected) <= 0;
            case 'in': return listValues.includes(actual);
            case 'contains':
                return Array.isArray(value)
                    ? value.some((entry) => String(entry) === wanted)
                    : actual.toLocaleLowerCase().includes(wanted.toLocaleLowerCase());
            case 'like': {
                const pattern = wanted.split('%')
                    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('.*');
                return new RegExp(`.*${pattern}.*`, 'i').test(actual);
            }
            default: return false;
        }
    }));
}

function matchesSearch(value, search) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some((item) => matchesSearch(item, search));
    if (typeof value === 'object') return Object.values(value).some((item) => matchesSearch(item, search));
    return String(value).toLocaleLowerCase().includes(search.toLocaleLowerCase());
}

function getPath(value, path) {
    return path.split('.').reduce((current, part) => current?.[part], value);
}

function sortItems(items, query) {
    const fields = asList(query._sort || []).flatMap((value) => String(value).split(',')).filter(Boolean);
    const directions = asList(query._order || []).flatMap((value) => String(value).split(','));
    if (fields.length === 0) return items;

    return items.sort((left, right) => {
        for (const [index, field] of fields.entries()) {
            const direction = (directions[index] || directions[0] || 'asc').toLowerCase() === 'desc' ? -1 : 1;
            const comparison = compareValues(getPath(left, field), getPath(right, field));
            if (comparison !== 0) return comparison * direction;
        }
        return 0;
    });
}

function paginate(items, query) {
    const parseIndex = (value, fallback) => {
        const number = Number.parseInt(value, 10);
        return Number.isFinite(number) ? Math.max(0, Math.min(number, 1_000_000_000)) : fallback;
    };
    const hasLimit = query._limit !== undefined;
    const hasPage = query._page !== undefined;
    const limit = hasLimit ? Math.min(parseIndex(query._limit, items.length), 100) : hasPage ? 10 : undefined;
    let start = query._start === undefined ? 0 : parseIndex(query._start, 0);
    let end = query._end === undefined ? items.length : parseIndex(query._end, items.length);

    if (hasPage) {
        start = (Math.max(1, parseIndex(query._page, 1)) - 1) * limit;
        end = start + limit;
    } else if (limit !== undefined) {
        end = start + limit;
    }
    return items.slice(start, Math.max(start, end));
}

function projectFields(items, fieldQuery) {
    if (fieldQuery === undefined) return items;
    const fields = asList(fieldQuery).flatMap((value) => String(value).split(',')).filter(Boolean);
    return items.map((item) => Object.fromEntries(fields
        .filter((field) => Object.hasOwn(item, field))
        .map((field) => [field, item[field]])));
}

function queryCollection(collection, query = {}) {
    let result = collection.filter((item) => Object.entries(query).every(([key, rawExpected]) => {
        if (key === 'q') return matchesSearch(item, String(rawExpected));
        if (META_KEYS.has(key)) return true;
        const operatorMatch = key.match(OPERATOR_PATTERN);
        const field = operatorMatch ? operatorMatch[1] : key;
        const operator = operatorMatch ? operatorMatch[2] : 'eq';
        const values = getValuesAtPath(item, field.split('.'));
        return matchesOperator(values, operator, asList(rawExpected));
    }));

    result = sortItems(result, query);
    result = paginate(result, query);
    return projectFields(result, query._fields);
}

module.exports = { queryCollection };