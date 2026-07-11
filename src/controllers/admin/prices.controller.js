const { supabaseAdmin } = require('../../config/supabase');
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

    const { data, error } = await supabaseAdmin
      .from('prices')
      .select('*')
      .eq('cabin_id', cabin_id);

    if (error) throw error;

    const externalBookings = await externalCalendarService.getExternalBookingsForRange(cabin_id, from, addOneDay(to));
    const external_dates = [];
    (externalBookings || []).forEach((booking) => {
      const current = new Date(booking.check_in + 'T00:00:00');
      const end = new Date(booking.check_out + 'T00:00:00');
      while (current < end) {
        external_dates.push({
          date: current.toISOString().slice(0, 10),
          source_name: booking.source_name || 'Внешний календарь',
          summary: booking.summary || null,
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

    if (remove) {
      const { error } = await supabaseAdmin
        .from('prices')
        .delete()
        .eq('cabin_id', cabin_id)
        .in('date', dates);
      
      if (error) throw error;
      return res.json({ success: true });
    }

    if (!is_closed && custom_price == null) {
       return res.status(400).json({ success: false, error: 'Особая цена обязательна' });
    }

    const rows = dates.map(date => ({
      cabin_id,
      date,
      custom_price: custom_price ? parseInt(custom_price) : 0,
      is_promo: Boolean(is_promo),
      promo_description: is_closed ? 'CLOSED' : (promo_description || null)
    }));

    const { error } = await supabaseAdmin
      .from('prices')
      .upsert(rows, { onConflict: 'cabin_id, date' });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[prices.controller] POST /prices/bulk-upsert error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения цен' });
  }
};
