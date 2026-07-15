const { supabaseAdmin } = require('../../config/supabase');
const dataStore = require('../../services/dataStore.service');

exports.getAnalytics = async (req, res) => {
  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        cabin_id,
        check_in,
        check_out,
        guests_count,
        status,
        total_price,
        created_at,
        cabins ( name ),
        guests ( full_name, phone, telegram )
      `)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const statusLabels = {
      pending: 'Ожидает',
      confirmed: 'Подтверждена',
      cancelled: 'Отменена',
      completed: 'Завершена',
    };

    const summary = {
      total_bookings: 0,
      active_bookings: 0,
      pending_bookings: 0,
      confirmed_bookings: 0,
      cancelled_bookings: 0,
      completed_bookings: 0,
      gross_revenue: 0,
      active_revenue: 0,
      confirmed_revenue: 0,
      pending_revenue: 0,
      cancelled_revenue: 0,
      avg_check: 0,
      total_nights: 0,
      active_nights: 0,
      guests_count: 0,
      unique_guests: 0,
    };

    const byStatus = {};
    const byCabin = {};
    const byMonth = {};
    const guestsMap = {};

    function getNights(checkIn, checkOut) {
      const start = new Date(checkIn + 'T00:00:00');
      const end = new Date(checkOut + 'T00:00:00');
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
      return Number.isFinite(diff) && diff > 0 ? diff : 0;
    }

    (bookings || []).forEach((booking) => {
      const status = booking.status || 'pending';
      const price = Number(booking.total_price) || 0;
      const nights = getNights(booking.check_in, booking.check_out);
      const guests = Number(booking.guests_count) || 0;
      const isCancelled = status === 'cancelled';
      const isConfirmedRevenue = status === 'confirmed' || status === 'completed';
      const cabinName = booking.cabins?.name || 'Без домика';
      const cabinKey = booking.cabin_id || cabinName;
      const monthKey = booking.check_in ? booking.check_in.slice(0, 7) : 'unknown';
      const phone = booking.guests?.phone || 'unknown:' + booking.id;

      summary.total_bookings += 1;
      summary.gross_revenue += price;
      summary.total_nights += nights;
      summary.guests_count += guests;

      if (status === 'pending') summary.pending_bookings += 1;
      if (status === 'confirmed') summary.confirmed_bookings += 1;
      if (status === 'cancelled') summary.cancelled_bookings += 1;
      if (status === 'completed') summary.completed_bookings += 1;

      if (!isCancelled) {
        summary.active_bookings += 1;
        summary.active_revenue += price;
        summary.active_nights += nights;
      } else {
        summary.cancelled_revenue += price;
      }

      if (isConfirmedRevenue) summary.confirmed_revenue += price;
      if (status === 'pending') summary.pending_revenue += price;

      if (!byStatus[status]) {
        byStatus[status] = {
          status,
          label: statusLabels[status] || status,
          bookings: 0,
          revenue: 0,
          nights: 0,
        };
      }
      byStatus[status].bookings += 1;
      byStatus[status].revenue += price;
      byStatus[status].nights += nights;

      if (!byCabin[cabinKey]) {
        byCabin[cabinKey] = {
          cabin_id: booking.cabin_id,
          cabin_name: cabinName,
          bookings: 0,
          active_bookings: 0,
          revenue: 0,
          confirmed_revenue: 0,
          nights: 0,
          guests_count: 0,
          avg_check: 0,
        };
      }
      byCabin[cabinKey].bookings += 1;
      byCabin[cabinKey].nights += nights;
      byCabin[cabinKey].guests_count += guests;
      if (!isCancelled) {
        byCabin[cabinKey].active_bookings += 1;
        byCabin[cabinKey].revenue += price;
      }
      if (isConfirmedRevenue) byCabin[cabinKey].confirmed_revenue += price;

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          month: monthKey,
          bookings: 0,
          active_bookings: 0,
          revenue: 0,
          nights: 0,
        };
      }
      byMonth[monthKey].bookings += 1;
      byMonth[monthKey].nights += nights;
      if (!isCancelled) {
        byMonth[monthKey].active_bookings += 1;
        byMonth[monthKey].revenue += price;
      }

      if (!guestsMap[phone]) {
        guestsMap[phone] = {
          phone: booking.guests?.phone || '',
          name: booking.guests?.full_name || 'Неизвестно',
          telegram: booking.guests?.telegram || '',
          bookings: 0,
          active_bookings: 0,
          ltv: 0,
          last_booking: booking.created_at,
        };
      }
      guestsMap[phone].bookings += 1;
      guestsMap[phone].last_booking = booking.created_at;
      if (!isCancelled) {
        guestsMap[phone].active_bookings += 1;
        guestsMap[phone].ltv += price;
      }
    });

    summary.unique_guests = Object.keys(guestsMap).filter((key) => !key.startsWith('unknown:')).length;
    summary.avg_check = summary.active_bookings > 0
      ? Math.round(summary.active_revenue / summary.active_bookings)
      : 0;

    const cabins = Object.values(byCabin)
      .map((item) => ({
        ...item,
        avg_check: item.active_bookings > 0 ? Math.round(item.revenue / item.active_bookings) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const months = Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month));

    const topGuests = Object.values(guestsMap)
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        summary,
        statuses: Object.values(byStatus),
        cabins,
        months,
        top_guests: topGuests,
      },
    });
  } catch (err) {
    console.error('[crm.controller] GET /analytics error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки аналитики' });
  }
};

exports.getGuests = async (req, res) => {
  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        total_price,
        status,
        created_at,
        guests ( full_name, phone, telegram )
      `)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const notes = await dataStore.get('guest_notes', 'guest_notes.json', {});

    const guestsMap = {};

    bookings.forEach(b => {
      const phone = b.guests?.phone;
      if (!phone) return;

      if (!guestsMap[phone]) {
        guestsMap[phone] = {
          phone,
          name: b.guests?.full_name || 'Неизвестно',
          telegram: b.guests?.telegram || '',
          first_booking: b.created_at,
          last_booking: b.created_at,
          total_bookings: 0,
          ltv: 0,
          notes: notes[phone] || ''
        };
      }
      
      guestsMap[phone].last_booking = b.created_at;
      guestsMap[phone].total_bookings++;
      
      if (b.status !== 'cancelled') {
        guestsMap[phone].ltv += b.total_price;
      }
    });

    res.json({ success: true, data: Object.values(guestsMap) });
  } catch (err) {
    console.error('[crm.controller] GET /crm/guests error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки CRM данных' });
  }
};

exports.updateGuestNotes = async (req, res) => {
  try {
    const { phone } = req.params;
    const { notes } = req.body;
    
    await dataStore.update('guest_notes', 'guest_notes.json', {}, (currentNotes) => {
      currentNotes[String(phone).slice(0, 30)] = String(notes || '').slice(0, 5000);
      return currentNotes;
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[crm.controller] PATCH /crm/guests error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения заметок' });
  }
};
