const { pbAdmin } = require('../../config/pocketbase');
const externalCalendarService = require('../../services/externalCalendar.service');

function addOneDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

exports.getByCabin = async (req, res) => {
  try {
    const { cabin_id } = req.params;
    const from = req.query.from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const to = req.query.to || futureDate.toISOString().slice(0, 10);

    const data = await pbAdmin.collection('prices').getFullList({
      filter: `cabin_id = "${cabin_id}"`
    });

    const bookingsData = await pbAdmin.collection('bookings').getFullList({
      filter: `cabin_id = "${cabin_id}" && (status = "pending" || status = "confirmed")`,
      expand: 'guest_id'
    });

    const external_dates = [];
    
    // Внутренние бронирования
    if (bookingsData) {
      bookingsData.forEach((booking) => {
        const current = new Date(booking.check_in + 'T00:00:00');
        const end = new Date(booking.check_out + 'T00:00:00');
        const guestName = booking.expand?.guest_id?.full_name ? booking.expand.guest_id.full_name : 'Гость';
        // Первые 5 букв имени
        const shortName = guestName.substring(0, 5) + (guestName.length > 5 ? '.' : '');
        
        while (current < end) {
          const dateStr =
            current.getFullYear() + '-' +
            String(current.getMonth() + 1).padStart(2, '0') + '-' +
            String(current.getDate()).padStart(2, '0');
          external_dates.push({
            date: dateStr,
            source_name: shortName,
            is_internal: true
          });
          current.setDate(current.getDate() + 1);
        }
      });
    }

    const externalBookings = await externalCalendarService.getExternalBookingsForRange(cabin_id, from, addOneDay(to));
    (externalBookings || []).forEach((booking) => {
      const current = new Date(booking.check_in + 'T00:00:00');
      const end = new Date(booking.check_out + 'T00:00:00');
      while (current < end) {
        const dateStr =
          current.getFullYear() + '-' +
          String(current.getMonth() + 1).padStart(2, '0') + '-' +
          String(current.getDate()).padStart(2, '0');
        external_dates.push({
          date: dateStr,
          source_name: booking.source_name || 'Внешний календарь',
          summary: booking.summary || null,
          is_internal: false
        });
        current.setDate(current.getDate() + 1);
      }
    });

    res.json({ success: true, data, external_dates });
  } catch (err) {
    console.error('[prices.controller] GET /prices error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки цен' });
  }
};

exports.bulkUpsert = async (req, res) => {
  try {
    const { cabin_id, dates, custom_price, is_promo, remove, is_closed, promo_description } = req.body;
    
    if (!cabin_id || !dates || !dates.length) {
      return res.status(400).json({ success: false, error: 'Не переданы даты или домик' });
    }

    const existingPrices = await pbAdmin.collection('prices').getFullList({
      filter: `cabin_id = "${cabin_id}"`
    });

    const priceMap = {};
    existingPrices.forEach(p => {
      const dateKey = p.date.split(' ')[0];
      priceMap[dateKey] = p;
    });

    if (remove) {
      for (const date of dates) {
        if (priceMap[date]) {
          await pbAdmin.collection('prices').delete(priceMap[date].id);
        }
      }
      return res.json({ success: true });
    }

    if (!is_closed && custom_price == null) {
       return res.status(400).json({ success: false, error: 'Особая цена обязательна' });
    }

    for (const date of dates) {
      const row = {
        cabin_id,
        date,
        custom_price: custom_price ? parseInt(custom_price) : 0,
        is_promo: Boolean(is_promo),
        promo_description: is_closed ? 'CLOSED' : (promo_description || null)
      };

      if (priceMap[date]) {
        await pbAdmin.collection('prices').update(priceMap[date].id, row);
      } else {
        await pbAdmin.collection('prices').create(row);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[prices.controller] POST /prices/bulk-upsert error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения цен' });
  }
};
