const { pbAdmin } = require('../../config/pocketbase');
const dataStore = require('../../services/dataStore.service');
const { normalizeBookingRecord } = require('../../utils/bookingRecord');

exports.getAnalytics = async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const targetDate = req.query.date;
    const targetMonth = req.query.month;

    let bookingsRaw = [];
    try {
      bookingsRaw = await pbAdmin.collection('bookings').getFullList({
        sort: '-check_in_date'
      });
    } catch (_err) {
      bookingsRaw = await pbAdmin.collection('bookings').getFullList();
    }
    const bookings = bookingsRaw.map(normalizeBookingRecord);

    let allCabins = [];
    try {
      allCabins = await pbAdmin.collection('cabins').getFullList();
    } catch (_e) {}
    const cabinsMap = {};
    allCabins.forEach((c) => { cabinsMap[c.id] = c; });

    let allGuests = [];
    try {
      allGuests = await pbAdmin.collection('guests').getFullList();
    } catch (_e) {}
    const guestsMapById = {};
    allGuests.forEach((g) => { guestsMapById[g.id] = g; });

    function getNights(checkIn, checkOut) {
      const start = new Date(checkIn + 'T00:00:00');
      const end = new Date(checkOut + 'T00:00:00');
      const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
      return Number.isFinite(diff) && diff > 0 ? diff : 0;
    }

    let filteredBookings = bookings || [];
    if (period !== 'all') {
      const isDay = period === 'day' && targetDate;
      const isMonth = period === 'month' && targetMonth;

      filteredBookings = filteredBookings.filter(b => {
        const cIn = b.check_in || '';
        const cOut = b.check_out || '';
        const createdDate = b.created ? b.created.split(' ')[0] : '';
        const createdMonth = createdDate.substring(0, 7);
        
        if (isDay) {
          return createdDate === targetDate || (targetDate >= cIn && targetDate <= cOut);
        } else if (isMonth) {
          const cInMonth = cIn.substring(0, 7);
          const cOutMonth = cOut.substring(0, 7);
          return createdMonth === targetMonth || cInMonth === targetMonth || cOutMonth === targetMonth;
        }
        return true;
      });
    }

    const statusLabels = { pending: 'Ожидает', confirmed: 'Подтверждена', cancelled: 'Отменена', completed: 'Завершена' };
    const summary = { total_bookings: 0, active_bookings: 0, pending_bookings: 0, confirmed_bookings: 0, cancelled_bookings: 0, completed_bookings: 0, gross_revenue: 0, active_revenue: 0, confirmed_revenue: 0, pending_revenue: 0, cancelled_revenue: 0, avg_check: 0, total_nights: 0, active_nights: 0, guests_count: 0, active_guests: 0, unique_guests: 0 };
    const byStatus = {}; const byCabin = {}; const byMonth = {}; const guestsMap = {};

    (filteredBookings || []).forEach((booking) => {
      const status = booking.status || 'pending';
      const price = Number(booking.total_price) || 0;
      const nights = getNights(booking.check_in, booking.check_out);
      const guests = Number(booking.guests_count) || 0;
      const isCancelled = status === 'cancelled';
      const isConfirmedRevenue = status === 'confirmed' || status === 'completed';
      
      const cabin = booking.expand?.cabin_id || cabinsMap[booking.cabin_id];
      const guest = booking.expand?.guest_id || guestsMapById[booking.guest_id];
      
      const cabinName = cabin?.name || (booking.cabin_id ? `Домик (${booking.cabin_id})` : 'Без домика');
      const cabinKey = booking.cabin_id || cabinName;
      const monthKey = booking.check_in ? booking.check_in.slice(0, 7) : 'unknown';
      const phone = guest?.phone || (booking.guest_phone || 'unknown:' + booking.id);

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
        summary.active_guests += guests;
      } else {
        summary.cancelled_revenue += price;
      }

      if (isConfirmedRevenue) summary.confirmed_revenue += price;
      if (status === 'pending') summary.pending_revenue += price;

      if (!byStatus[status]) {
        byStatus[status] = { status, label: statusLabels[status] || status, bookings: 0, revenue: 0, nights: 0 };
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
          cancelled_bookings: 0,
          revenue: 0,
          confirmed_revenue: 0,
          nights: 0,
          active_nights: 0,
          guests_count: 0,
          active_guests: 0,
          avg_check: 0
        };
      }
      byCabin[cabinKey].bookings += 1;
      byCabin[cabinKey].nights += nights;
      byCabin[cabinKey].guests_count += guests;
      if (!isCancelled) {
        byCabin[cabinKey].active_bookings += 1;
        byCabin[cabinKey].active_nights += nights;
        byCabin[cabinKey].active_guests += guests;
        byCabin[cabinKey].revenue += price;
      } else {
        byCabin[cabinKey].cancelled_bookings += 1;
      }
      if (isConfirmedRevenue) byCabin[cabinKey].confirmed_revenue += price;

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          month: monthKey,
          bookings: 0,
          active_bookings: 0,
          cancelled_bookings: 0,
          revenue: 0,
          nights: 0,
          active_nights: 0
        };
      }
      byMonth[monthKey].bookings += 1;
      byMonth[monthKey].nights += nights;
      if (!isCancelled) {
        byMonth[monthKey].active_bookings += 1;
        byMonth[monthKey].active_nights += nights;
        byMonth[monthKey].revenue += price;
      } else {
        byMonth[monthKey].cancelled_bookings += 1;
      }

      if (!guestsMap[phone]) {
        guestsMap[phone] = {
          phone: guest?.phone || booking.guest_phone || '',
          name: guest?.full_name || booking.guest_name || 'Неизвестно',
          telegram: guest?.telegram || booking.guest_telegram || '',
          bookings: 0,
          active_bookings: 0,
          ltv: 0,
          last_booking: booking.created
        };
      }
      guestsMap[phone].bookings += 1;
      guestsMap[phone].last_booking = booking.created;
      if (!isCancelled) {
        guestsMap[phone].active_bookings += 1;
        guestsMap[phone].ltv += price;
      }
    });

    summary.unique_guests = Object.keys(guestsMap).filter((key) => !key.startsWith('unknown:')).length;
    summary.avg_check = summary.active_bookings > 0 ? Math.round(summary.active_revenue / summary.active_bookings) : 0;

    const cabins = Object.values(byCabin).map((item) => ({ ...item, avg_check: item.active_bookings > 0 ? Math.round(item.revenue / item.active_bookings) : 0 })).sort((a, b) => b.revenue - a.revenue);
    const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    const topGuests = Object.values(guestsMap).sort((a, b) => b.ltv - a.ltv).slice(0, 10);

    res.json({
      success: true,
      data: { summary, statuses: Object.values(byStatus), cabins, months, top_guests: topGuests },
    });
  } catch (err) {
    console.error('[crm.controller] GET /analytics error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки аналитики' });
  }
};

exports.getGuests = async (req, res) => {
  try {
    let bookings = [];
    try {
      bookings = await pbAdmin.collection('bookings').getFullList({
        sort: '-check_in_date'
      });
    } catch (_err) {
      bookings = await pbAdmin.collection('bookings').getFullList();
    }

    let allGuests = [];
    try {
      allGuests = await pbAdmin.collection('guests').getFullList();
    } catch (_e) {}
    const guestsMapById = {};
    allGuests.forEach((g) => { guestsMapById[g.id] = g; });

    const notes = await dataStore.get('guest_notes', 'guest_notes.json', {});

    const guestsMap = {};

    bookings.forEach(b => {
      const guest = b.expand?.guest_id || guestsMapById[b.guest_id];
      const phone = guest?.phone || b.guest_phone;
      if (!phone) return;

      if (!guestsMap[phone]) {
        guestsMap[phone] = {
          phone,
          name: guest?.full_name || b.guest_name || 'Неизвестно',
          telegram: guest?.telegram || b.guest_telegram || '',
          first_booking: b.created,
          last_booking: b.created,
          total_bookings: 0,
          ltv: 0,
          notes: notes[phone] || ''
        };
      }
      
      guestsMap[phone].last_booking = b.created;
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
