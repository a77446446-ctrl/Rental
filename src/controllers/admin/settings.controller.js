const fs = require('fs');
const path = require('path');
const settingsPath = path.join(__dirname, '../../data/settings.json');
const amenitiesPath = path.join(__dirname, '../../data/amenities.json');
const mainpagePath = path.join(__dirname, '../../data/mainpage.json');
const tagsPath = path.join(__dirname, '../../data/tags.json');
const cabinTagsPath = path.join(__dirname, '../../data/cabin_tags.json');

exports.getSettings = async (req, res) => {
  try {
    let settings = { checkInTime: '16:00', checkOutTime: '14:00' };
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки настроек' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сохранения настроек' });
  }
};

exports.getAmenities = async (req, res) => {
  try {
    let amenities = {};
    if (fs.existsSync(amenitiesPath)) {
      amenities = JSON.parse(fs.readFileSync(amenitiesPath, 'utf8'));
    }
    res.json({ success: true, data: amenities });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения' });
  }
};

exports.updateAmenities = async (req, res) => {
  try {
    const { cabinId, selectedAmenities } = req.body;
    let amenities = {};
    if (fs.existsSync(amenitiesPath)) {
      amenities = JSON.parse(fs.readFileSync(amenitiesPath, 'utf8'));
    }
    amenities[cabinId] = selectedAmenities || [];
    fs.writeFileSync(amenitiesPath, JSON.stringify(amenities, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сохранения наполнения' });
  }
};

exports.getMainpage = async (req, res) => {
  try {
    let mainpageData = {};
    if (fs.existsSync(mainpagePath)) {
      mainpageData = JSON.parse(fs.readFileSync(mainpagePath, 'utf8'));
    }
    res.json({ success: true, data: mainpageData });
  } catch (err) {
    console.error('[settings.controller] GET /mainpage error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки главной страницы' });
  }
};

exports.updateMainpage = async (req, res) => {
  try {
    let previousData = {};
    if (fs.existsSync(mainpagePath)) {
      previousData = JSON.parse(fs.readFileSync(mainpagePath, 'utf8'));
    }
    const nextData = {
      ...previousData,
      ...req.body,
      contacts: { ...(previousData.contacts || {}), ...(req.body.contacts || {}) },
      features_meta: req.body.features_meta || previousData.features_meta || { label: '', title: '' },
      reviews_meta: req.body.reviews_meta || previousData.reviews_meta || { label: '', title: '' }
    };
    fs.writeFileSync(mainpagePath, JSON.stringify(nextData, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('[settings.controller] POST /mainpage error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения главной страницы' });
  }
};

exports.getTags = async (req, res) => {
  try {
    let tags = [];
    if (fs.existsSync(tagsPath)) {
      tags = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
    }
    res.json({ success: true, data: tags });
  } catch (err) {
    console.error('[settings.controller] GET /tags error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки тегов' });
  }
};

exports.updateTags = async (req, res) => {
  try {
    const { tags } = req.body;
    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, error: 'Ожидается массив тегов' });
    }
    fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('[settings.controller] POST /tags error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения тегов' });
  }
};

exports.getCabinTags = async (req, res) => {
  try {
    let cabinTags = {};
    if (fs.existsSync(cabinTagsPath)) {
      cabinTags = JSON.parse(fs.readFileSync(cabinTagsPath, 'utf8'));
    }
    res.json({ success: true, data: cabinTags });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки тегов домиков' });
  }
};

exports.updateCabinTags = async (req, res) => {
  try {
    const { cabinId, selectedTags } = req.body;
    let cabinTags = {};
    if (fs.existsSync(cabinTagsPath)) {
      cabinTags = JSON.parse(fs.readFileSync(cabinTagsPath, 'utf8'));
    }
    cabinTags[cabinId] = selectedTags || [];
    fs.writeFileSync(cabinTagsPath, JSON.stringify(cabinTags, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка сохранения тегов домика' });
  }
};
