const express = require('express');
const multer = require('multer');

const { requireAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const authController = require('../controllers/admin/auth.controller');
const cabinsController = require('../controllers/admin/cabins.controller');
const calendarsController = require('../controllers/admin/calendars.controller');
const servicesController = require('../controllers/admin/services.controller');
const pricesController = require('../controllers/admin/prices.controller');
const bookingsController = require('../controllers/admin/bookings.controller');
const chatsController = require('../controllers/admin/chats.controller');
const crmController = require('../controllers/admin/crm.controller');
const settingsController = require('../controllers/admin/settings.controller');

const router = express.Router();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null,
    ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(file.mimetype)),
});
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Middleware для обработки ошибок multer (фото домиков)
const handlePhotoUpload = (req, res, next) => {
  photoUpload.single('photo')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'Файл отклонен. Максимум 12 МБ; форматы JPG, PNG, WEBP, AVIF или GIF.' });
    } else if (err) {
      return res.status(500).json({ success: false, error: 'Неизвестная ошибка загрузки' });
    }
    next();
  });
};

// Middleware для обработки ошибок multer (файлы чата)
const handleChatUpload = (req, res, next) => {
  chatUpload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'Размер файла превышает лимит (50 МБ)' });
    } else if (err) {
      return res.status(500).json({ success: false, error: 'Ошибка загрузки файла' });
    }
    next();
  });
};

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------
router.post('/login', authLimiter, authController.login);
router.post('/logout', requireAdmin, authController.logout);
router.get('/me', requireAdmin, authController.me);

// -----------------------------------------------------------------------------
// Cabins
// -----------------------------------------------------------------------------
router.get('/cabins', requireAdmin, cabinsController.getAll);
router.post('/cabins/save-full', requireAdmin, cabinsController.saveFull);
router.post('/cabins', requireAdmin, cabinsController.create);
router.patch('/cabins/:id', requireAdmin, cabinsController.update);
router.delete('/cabins/:id', requireAdmin, cabinsController.remove);
router.post('/cabins/upload', requireAdmin, handlePhotoUpload, cabinsController.uploadImage);
router.post('/upload', requireAdmin, handlePhotoUpload, cabinsController.uploadImage);
router.delete('/uploads/images', requireAdmin, cabinsController.removeUploadedImage);

// -----------------------------------------------------------------------------
// External Calendars
// -----------------------------------------------------------------------------
router.get('/cabins/:id/external-calendars', requireAdmin, calendarsController.getSources);
router.post('/cabins/:id/external-calendars', requireAdmin, calendarsController.saveSources);
router.post('/external-calendars/:sourceId/sync', requireAdmin, calendarsController.syncSource);
router.post('/external-calendars/sync-all', requireAdmin, calendarsController.syncAll);

// -----------------------------------------------------------------------------
// Extra Services & House Items
// -----------------------------------------------------------------------------
router.get('/extra-services', requireAdmin, servicesController.getExtraServices);
router.post('/extra-services', requireAdmin, servicesController.createExtraService);
router.patch('/extra-services/:id', requireAdmin, servicesController.updateExtraService);
router.delete('/extra-services/:id', requireAdmin, servicesController.removeExtraService);

router.get('/house-items', requireAdmin, servicesController.getHouseItems);
router.post('/house-items', requireAdmin, servicesController.createHouseItem);
router.patch('/house-items/:id', requireAdmin, servicesController.updateHouseItem);
router.delete('/house-items/:id', requireAdmin, servicesController.removeHouseItem);

// -----------------------------------------------------------------------------
// Prices
// -----------------------------------------------------------------------------
router.get('/prices/:cabin_id', requireAdmin, pricesController.getByCabin);
router.post('/prices/bulk-upsert', requireAdmin, pricesController.bulkUpsert);

// -----------------------------------------------------------------------------
// Bookings
// -----------------------------------------------------------------------------
router.get('/bookings', requireAdmin, bookingsController.getAll);
router.patch('/bookings/:id/status', requireAdmin, bookingsController.updateStatus);
router.patch('/bookings/:id', requireAdmin, bookingsController.updateInfo);

// -----------------------------------------------------------------------------
// Chats
// -----------------------------------------------------------------------------
router.get('/chats', requireAdmin, chatsController.getAll);
router.get('/chats/:token/messages', requireAdmin, chatsController.getMessages);
router.post('/chats/:token/messages', requireAdmin, chatsController.sendMessage);
router.post('/chats/:token/upload', requireAdmin, handleChatUpload, chatsController.uploadMedia);

// -----------------------------------------------------------------------------
// CRM & Analytics
// -----------------------------------------------------------------------------
router.get('/analytics', requireAdmin, crmController.getAnalytics);
router.get('/crm/guests', requireAdmin, crmController.getGuests);
router.patch('/crm/guests/:phone', requireAdmin, crmController.updateGuestNotes);

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------
router.get('/settings', requireAdmin, settingsController.getSettings);
router.post('/settings', requireAdmin, settingsController.updateSettings);

router.get('/amenities', requireAdmin, settingsController.getAmenities);
router.post('/amenities', requireAdmin, settingsController.updateAmenities);

router.get('/mainpage', requireAdmin, settingsController.getMainpage);
router.post('/mainpage', requireAdmin, settingsController.updateMainpage);

router.get('/tags', requireAdmin, settingsController.getTags);
router.post('/tags', requireAdmin, settingsController.updateTags);

router.get('/cabin-tags', requireAdmin, settingsController.getCabinTags);
router.post('/cabin-tags', requireAdmin, settingsController.updateCabinTags);

module.exports = router;
