const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backendPath = __dirname;
const imageDirectory = path.join(backendPath, 'uploads', 'img');
const productImageDirectory = path.join(imageDirectory, 'product');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const jsonPaths = ['catalog.json', 'orders.json', 'userData.json']
    .map((filename) => path.join(backendPath, filename))
    .filter((filePath) => fs.existsSync(filePath));

function updateImageUrls(value, filenames) {
    if (Array.isArray(value)) {
        return value.map((entry) => updateImageUrls(entry, filenames));
    }

    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
        if (key === 'img' && typeof entry === 'string') {
            const updatedImageUrl = entry.replace(/\/uploads\/img\/([^/?#]+)/g, (match, filename) =>
                filenames.has(filename) ? `/uploads/img/product/${filename}` : match
            );
            return [key, updatedImageUrl];
        }

        return [key, updateImageUrls(entry, filenames)];
    }));
}

function migrateProductImages() {
    fs.mkdirSync(productImageDirectory, { recursive: true });

    const imageFiles = fs.readdirSync(imageDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => entry.name);
    const filenameSet = new Set(imageFiles);
    const collisions = imageFiles.filter((filename) =>
        fs.existsSync(path.join(productImageDirectory, filename))
    );

    if (collisions.length > 0) {
        throw new Error(`В папке product уже существуют файлы с такими именами: ${collisions.join(', ')}`);
    }

    const jsonUpdates = jsonPaths.map((filePath) => {
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(originalContent);
        const updatedData = updateImageUrls(data, filenameSet);

        return {
            filePath,
            originalContent,
            temporaryPath: `${filePath}.${crypto.randomUUID()}.tmp`,
            updatedContent: `${JSON.stringify(updatedData, null, 2)}\n`
        };
    });

    const movedFiles = [];
    const replacedJsonFiles = [];
    try {
        for (const update of jsonUpdates) {
            fs.writeFileSync(update.temporaryPath, update.updatedContent);
        }

        for (const filename of imageFiles) {
            const sourcePath = path.join(imageDirectory, filename);
            const destinationPath = path.join(productImageDirectory, filename);
            fs.renameSync(sourcePath, destinationPath);
            movedFiles.push({ sourcePath, destinationPath });
        }

        for (const update of jsonUpdates) {
            fs.renameSync(update.temporaryPath, update.filePath);
            replacedJsonFiles.push(update);
        }
    } catch (error) {
        const rollbackErrors = [];

        for (const update of replacedJsonFiles.reverse()) {
            try {
                fs.writeFileSync(update.temporaryPath, update.originalContent);
                fs.renameSync(update.temporaryPath, update.filePath);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
        }

        for (const movedFile of movedFiles.reverse()) {
            try {
                fs.renameSync(movedFile.destinationPath, movedFile.sourcePath);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
        }

        for (const update of jsonUpdates) {
            if (fs.existsSync(update.temporaryPath)) fs.unlinkSync(update.temporaryPath);
        }

        if (rollbackErrors.length > 0) {
            throw new AggregateError([error, ...rollbackErrors], 'Миграция изображений и откат завершились с ошибкой');
        }

        throw error;
    }

    return imageFiles.length;
}

if (require.main === module) {
    try {
        const movedCount = migrateProductImages();
        console.log(`Перенесено изображений: ${movedCount}`);
    } catch (error) {
        console.error('Ошибка миграции изображений:', error);
        process.exitCode = 1;
    }
}

module.exports = { migrateProductImages };
