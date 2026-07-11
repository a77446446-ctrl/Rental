const externalCalendarService = require('../../services/externalCalendar.service');

exports.getSources = async (req, res) => {
  try {
    const sources = await externalCalendarService.getSources(req.params.id);
    res.json({ success: true, data: sources });
  } catch (err) {
    console.error('[calendars.controller] GET /cabins external calendars error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: 'Ошибка загрузки внешних календарей' });
  }
};

exports.saveSources = async (req, res) => {
  try {
    const sources = await externalCalendarService.saveSources(req.params.id, req.body.sources || []);
    res.json({ success: true, data: sources });
  } catch (err) {
    console.error('[calendars.controller] POST /cabins external calendars error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: err.message || 'Ошибка сохранения внешних календарей' });
  }
};

exports.syncSource = async (req, res) => {
  try {
    const result = await externalCalendarService.syncSourceById(req.params.sourceId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[calendars.controller] POST /external-calendars sync error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: err.message || 'Ошибка синхронизации календаря' });
  }
};

exports.syncAll = async (req, res) => {
  try {
    const result = await externalCalendarService.syncAllActiveSources();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[calendars.controller] POST /external-calendars sync-all error:', err);
    if (externalCalendarService.isExternalCalendarSchemaMissing(err)) {
      return res.status(400).json({
        success: false,
        error: 'Сначала примените миграцию src/sql/005_external_calendars.sql в Supabase',
      });
    }
    res.status(500).json({ success: false, error: 'Ошибка синхронизации календарей' });
  }
};
