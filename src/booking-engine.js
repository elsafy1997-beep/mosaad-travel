/**
 * Booking Engine — محرك حساب أسعار الفنادق
 * 
 * يستخدم:
 * - hotel_room_types (نوع الغرفة)
 * - hotel_room_prices (أسعار الفترات)
 * - hotel_child_policies (سياسات الأطفال)
 * - hotel_meal_plans (خطط الوجبات)
 */

import { db } from './db.js';

/**
 * حساب سعر حجز فندقي كامل
 * 
 * @param {Object} params
 * @param {number} params.hotel_id
 * @param {number} params.room_type_id
 * @param {string} params.date_from - YYYY-MM-DD
 * @param {string} params.date_to - YYYY-MM-DD
 * @param {number} params.adults - عدد البالغين
 * @param {number[]} params.children_ages - أعمار الأطفال
 * @param {number} [params.meal_plan_id] - اختياري
 * @returns {Object} تفاصيل الحساب
 */
export function calculateBooking(params) {
  const {
    hotel_id,
    room_type_id,
    date_from,
    date_to,
    adults = 1,
    children_ages = [],
    child_bed_types = [],
    meal_plan_id = null
  } = params;

  // ==========================================
  // 1) التحقق من المدخلات
  // ==========================================
  if (!hotel_id || !room_type_id) {
    throw new Error('hotel_id و room_type_id مطلوبان');
  }
  if (!date_from || !date_to) {
    throw new Error('التواريخ مطلوبة');
  }
  if (new Date(date_to) <= new Date(date_from)) {
    throw new Error('تاريخ النهاية يجب أن يكون بعد البداية');
  }
  if (adults < 1) {
    throw new Error('يجب أن يكون هناك بالغ واحد على الأقل');
  }

  // ==========================================
  // 2) جلب نوع الغرفة
  // ==========================================
  const roomType = db.prepare(`
    SELECT * FROM hotel_room_types WHERE id = ? AND hotel_id = ?
  `).get(room_type_id, hotel_id);

  if (!roomType) {
    throw new Error('نوع الغرفة غير موجود أو لا ينتمي لهذا الفندق');
  }

  // ==========================================
  // 3) عدد الليالي
  // ==========================================
  const nights = Math.ceil(
    (new Date(date_to) - new Date(date_from)) / (1000 * 60 * 60 * 24)
  );

  if (nights < 1) {
    throw new Error('عدد الليالي يجب أن يكون 1 على الأقل');
  }

  // ==========================================
  // 4) التحقق من الإشغال (مع قواعد الإشغال المخصصة)
  // ==========================================
  const totalGuests = adults + children_ages.length;
  const childrenCount = children_ages.length;

  // ✅ جلب قواعد الإشغال المخصصة (إن وجدت)
  const occupancyRules = db.prepare(`
    SELECT * FROM hotel_room_occupancy_rules 
    WHERE room_type_id = ? 
    ORDER BY sort_order, id
  `).all(room_type_id);

  if (occupancyRules.length > 0) {
    // ✅ هناك قواعد مخصصة — تحقق منها
    let allowed = false;
    let denyReason = null;
    
    // 1) ابحث أولاً عن قواعد المنع (deny)
    for (const rule of occupancyRules.filter(r => r.action === 'deny')) {
      const adultsMatch = adults >= rule.adults_min && adults <= rule.adults_max;
      const childrenMatch = childrenCount >= rule.children_min && childrenCount <= rule.children_max;
      if (adultsMatch && childrenMatch) {
        denyReason = rule.description || `قاعدة منع مطبقة (بالغين: ${rule.adults_min}-${rule.adults_max}، أطفال: ${rule.children_min}-${rule.children_max})`;
        break;
      }
    }
    
    // 2) إذا لم تكن هناك قاعدة منع، ابحث عن قاعدة سماح
    if (!denyReason) {
      for (const rule of occupancyRules.filter(r => r.action === 'allow')) {
        const adultsMatch = adults >= rule.adults_min && adults <= rule.adults_max;
        const childrenMatch = childrenCount >= rule.children_min && childrenCount <= rule.children_max;
        if (adultsMatch && childrenMatch) {
          allowed = true;
          break;
        }
      }
    }
    
    // 3) إذا لم توجد قاعدة منع، لكن لا توجد قاعدة سماح مطابقة → استخدم الحقول الافتراضية
    if (!denyReason && !allowed) {
      // fallback: الحقول الافتراضية
      if (totalGuests > roomType.max_total) {
        throw new Error(`هذا النوع يستوعب ${roomType.max_total} أشخاص كحد أقصى، وأنت طلبت ${totalGuests}`);
      }
      if (adults > roomType.max_adults) {
        throw new Error(`أقصى عدد بالغين هو ${roomType.max_adults}`);
      }
      if (childrenCount > roomType.max_children) {
        throw new Error(`أقصى عدد أطفال هو ${roomType.max_children}`);
      }
      allowed = true;
    }
    
    if (denyReason) {
      throw new Error(`هذه التركيبة غير مسموحة: ${denyReason}`);
    }
    
    if (!allowed) {
      throw new Error(`هذه التركيبة (${adults} بالغين + ${childrenCount} أطفال) غير مسموحة لهذا النوع`);
    }
  } else {
    // ✅ لا توجد قواعد مخصصة — استخدم الحقول الافتراضية
    const maxCapacity = roomType.max_total + (roomType.has_extra_bed ? roomType.max_extra_beds : 0);

    if (totalGuests > maxCapacity) {
      throw new Error(
        `هذا النوع يستوعب ${roomType.max_total} أشخاص كحد أساسي` +
        (roomType.has_extra_bed ? ` + ${roomType.max_extra_beds} سرير إضافي = ${maxCapacity} كحد أقصى` : '') +
        `، وأنت طلبت ${totalGuests}`
      );
    }

    const maxAdultsAllowed = roomType.max_adults + (roomType.has_extra_bed ? roomType.max_extra_beds : 0);
    if (adults > maxAdultsAllowed) {
      throw new Error(
        `أقصى عدد بالغين هو ${roomType.max_adults}` +
        (roomType.has_extra_bed ? ` + ${roomType.max_extra_beds} سرير إضافي = ${maxAdultsAllowed}` : '')
      );
    }

    if (childrenCount > roomType.max_children + roomType.max_extra_beds) {
      throw new Error(`أقصى عدد أطفال هو ${roomType.max_children}`);
    }
  }

  // ==========================================
  // ✅ التحقق من وجود سعر رمزي (0 = طلب خاص)
  // ==========================================
  const allPricesCheck = db.prepare(`
    SELECT * FROM hotel_room_prices
    WHERE room_type_id = ?
    ORDER BY date_from
  `).all(room_type_id);
  
  const allZeroPrices = allPricesCheck.length > 0 && allPricesCheck.every(p => {
    const prices = [p.price_single, p.price_double, p.price_triple, p.price_quad].filter(v => v !== null);
    return prices.length > 0 && prices.every(v => v === 0);
  });
  
  if (allZeroPrices) {
    return {
      ok: true,
      is_request: true,
      hotel_id,
      room_type_id,
      room_type_name: roomType.name,
      date_from,
      date_to,
      nights,
      adults,
      children_ages,
      children_count: children_ages.length,
      total_guests: adults + children_ages.length,
      total: 0,
      currency: 'RUB',
      message: 'هذا النوع يتم إرسال طلب خاص للفندق. يرجى التواصل على الواتساب للاتفاق.',
      breakdown: [{
        label: '📞 طلب خاص للفندق',
        detail: 'يرجى التواصل على الواتساب للاتفاق',
        amount: 0
      }]
    };
  }

  // ==========================================
  // 5) حساب السعر يوم بيوم (يدعم فترات متعددة)
  // ==========================================
  const allPrices = db.prepare(`
    SELECT * FROM hotel_room_prices
    WHERE room_type_id = ?
    ORDER BY date_from
  `).all(room_type_id);

  if (allPrices.length === 0) {
    throw new Error('لا توجد فترات أسعار مُدخلة لهذا النوع. يرجى إضافة فترة من لوحة التحكم.');
  }

  // ✅ ابحث عن أول تاريخ غير مُغطى
  let uncoveredDate = null;
  let checkDate = new Date(date_from);
  const endDate = new Date(date_to);
  while (checkDate < endDate) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const found = allPrices.find(p => dateStr >= p.date_from && dateStr <= p.date_to);
    if (!found) {
      uncoveredDate = dateStr;
      break;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  if (uncoveredDate) {
    throw new Error(`التاريخ ${uncoveredDate} غير مُغطى بفترة سعر. يرجى إضافة فترة جديدة من لوحة التحكم.`);
  }

  // ✅ حساب السعر يوم بيوم
  const breakdown = [];
  let roomCost = 0;

  // اجمع الأيام المتتالية بنفس السعر في مجموعة واحدة (للعرض الجميل)
  const dailyPrices = [];
  let dayCursor = new Date(date_from);
  while (dayCursor < endDate) {
    const dateStr = dayCursor.toISOString().split('T')[0];
    const period = allPrices.find(p => dateStr >= p.date_from && dateStr <= p.date_to);
    
    // اختر السعر حسب عدد البالغين
    let price = 0;
    if (adults === 1) price = period.price_single || period.price_double || period.price_triple || period.price_quad || 0;
    else if (adults === 2) price = period.price_double || period.price_single || period.price_triple || period.price_quad || 0;
    else if (adults === 3) price = period.price_triple || period.price_double || period.price_single || period.price_quad || 0;
    else if (adults >= 4) price = period.price_quad || period.price_triple || period.price_double || period.price_single || 0;
    
    // ✅ إذا كانت الفترة بدون أسعار، استخدم السعر الافتراضي للفندق
    if (!price) {
      const hotel = db.prepare('SELECT price_rub FROM hotels WHERE id = ?').get(hotel_id);
      if (hotel && hotel.price_rub > 0) {
        price = hotel.price_rub;
        console.log('⚠️  Period ' + period.date_from + ' → ' + period.date_to + ' has no prices. Using hotel default: ' + price);
      } else {
        throw new Error(`لا يوجد سعر مناسب لعدد البالغين في الفترة ${period.date_from} → ${period.date_to}. يرجى إدخال الأسعار في لوحة التحكم.`);
      }
    }
    
    dailyPrices.push({
      date: dateStr,
      price: price,
      seasonName: period.season_name || ''
    });
    
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  // ✅ دمج الأيام المتتالية بنفس السعر
  let currentGroup = null;
  for (const dp of dailyPrices) {
    if (currentGroup && currentGroup.price === dp.price && currentGroup.seasonName === dp.seasonName) {
      currentGroup.nights++;
      currentGroup.to = dp.date;
    } else {
      if (currentGroup) {
        roomCost += currentGroup.price * currentGroup.nights;
        breakdown.push({
          label: `غرفة ${adults === 1 ? 'فردية' : adults === 2 ? 'مزدوجة' : adults === 3 ? 'ثلاثية' : 'رباعية'}${currentGroup.seasonName ? ' — ' + currentGroup.seasonName : ''}`,
          detail: `${currentGroup.price.toLocaleString('ar-EG')} RUB × ${currentGroup.nights} ليال (${currentGroup.from} → ${currentGroup.to})`,
          amount: currentGroup.price * currentGroup.nights
        });
      }
      currentGroup = {
        from: dp.date,
        to: dp.date,
        price: dp.price,
        seasonName: dp.seasonName,
        nights: 1
      };
    }
  }
  
  // ✅ إضافة المجموعة الأخيرة
  if (currentGroup) {
    roomCost += currentGroup.price * currentGroup.nights;
    breakdown.push({
      label: `غرفة ${adults === 1 ? 'فردية' : adults === 2 ? 'مزدوجة' : adults === 3 ? 'ثلاثية' : 'رباعية'}${currentGroup.seasonName ? ' — ' + currentGroup.seasonName : ''}`,
      detail: `${currentGroup.price.toLocaleString('ar-EG')} RUB × ${currentGroup.nights} ليال (${currentGroup.from} → ${currentGroup.to})`,
      amount: currentGroup.price * currentGroup.nights
    });
  }

  // للاستخدام في حساب الأطفال (نستخدم متوسط السعر)
  const basePricePerNight = Math.round(roomCost / nights);
  const seasonName = dailyPrices[0]?.seasonName || '';

  // ==========================================
  // 7) حساب سياسات الأطفال
  // ==========================================
  let childrenCost = 0;
  const childPolicies = db.prepare(`
    SELECT * FROM hotel_child_policies
    WHERE room_type_id = ?
    ORDER BY bed_type, age_from
  `).all(room_type_id);

  // تحديد عدد الأطفال في السرير الأساسي والأسرّة الإضافية
  const baseBedSlots = Math.max(0, roomType.max_total - adults);
  let childrenInBaseBed = 0;
  let childrenInExtraBed = 0;

  children_ages.forEach((age, idx) => {
    // الأطفال الأوائل يشغلون السرير الأساسي
    if (childrenInBaseBed < baseBedSlots) {
      childrenInBaseBed++;
    } else {
      childrenInExtraBed++;
    }
  });

  // حساب تكلفة كل طفل
  let baseBedIndex = 0;
  let extraBedIndex = 0;

  children_ages.forEach((age) => {
    // ✅ تحديد نوع السرير: إما من اختيار العميل، أو تلقائياً
    let bedType = child_bed_types[children_ages.indexOf(age)] || null;
    if (!bedType) {
      if (baseBedIndex < baseBedSlots) {
        bedType = 'base';
        baseBedIndex++;
      } else {
        if (age <= 5) {
          bedType = 'child';
        } else {
          bedType = 'extra';
        }
        extraBedIndex++;
      }
    } else {
      // تحديث الـ index حسب النوع المُختار
      if (bedType === 'base') baseBedIndex++;
      else extraBedIndex++;
    }

    // البحث عن سياسة تناسب هذا العمر ونوع السرير
    let policy = childPolicies.find(p =>
      p.bed_type === bedType &&
      age >= p.age_from &&
      age <= p.age_to
    );

    // ✅ إذا لم نجد، جرب الأنواع الأخرى بالترتيب
    if (!policy) {
      const fallbackOrder = ['extra', 'child', 'base'].filter(t => t !== bedType);
      for (const otherBedType of fallbackOrder) {
        policy = childPolicies.find(p =>
          p.bed_type === otherBedType &&
          age >= p.age_from &&
          age <= p.age_to
        );
        if (policy) {
          bedType = otherBedType;
          break;
        }
      }
    }

    if (!policy) {
      // لا توجد سياسة → احسبه كبالغ
      const adultCost = basePricePerNight * nights;
      childrenCost += adultCost;
      breakdown.push({
        label: `طفل ${age} سنة (لا توجد سياسة → سعر بالغ)`,
        detail: `${basePricePerNight.toLocaleString('ar-EG')} RUB × ${nights} ليال`,
        amount: adultCost
      });
      return;
    }

    if (policy.price_type === 'free') {
      breakdown.push({
        label: `طفل ${age} سنة (${bedType === 'base' ? 'سرير أساسي' : 'سرير إضافي'}) — مجاني`,
        detail: '',
        amount: 0
      });
    } else if (policy.price_type === 'fixed') {
      const cost = policy.price_value * nights;
      childrenCost += cost;
      breakdown.push({
        label: `طفل ${age} سنة (${bedType === 'base' ? 'سرير أساسي' : 'سرير إضافي'})`,
        detail: `${policy.price_value.toLocaleString('ar-EG')} RUB × ${nights} ليال`,
        amount: cost
      });
    } else if (policy.price_type === 'percent') {
      const cost = Math.round(basePricePerNight * (policy.price_value / 100)) * nights;
      childrenCost += cost;
      breakdown.push({
        label: `طفل ${age} سنة (${bedType === 'base' ? 'سرير أساسي' : 'سرير إضافي'})`,
        detail: `${policy.price_value}% من ${basePricePerNight.toLocaleString('ar-EG')} × ${nights} ليال`,
        amount: cost
      });
    }
  });

  // ==========================================
  // 8) حساب الأسرّة الإضافية (للبالغين أو الأطفال الزائدين)
  // ==========================================
  let extraBedCost = 0;

  // احسب الأسرّة الأساسية المتاحة (عادة 2)
  const baseBeds = 2;
  const guestsInBaseBeds = Math.min(totalGuests, baseBeds);
  const guestsNeedingExtraBeds = Math.max(0, totalGuests - baseBeds);

  // إذا كان هناك أطفال في الأسرّة الإضافية، يتم حسابهم في child_policies (bed_type='extra')
  // لكن إذا كان هناك بالغون في الأسرّة الإضافية، نحتاج لحسابهم هنا

  // عدد البالغين الذين يحتاجون أسرّة إضافية
  const adultsInBaseBeds = Math.min(adults, baseBeds);
  const adultsNeedingExtraBeds = Math.max(0, adults - adultsInBaseBeds);

  if (adultsNeedingExtraBeds > 0 && roomType.has_extra_bed) {
    const extraBedsNeeded = Math.min(adultsNeedingExtraBeds, roomType.max_extra_beds);
    const pricePerExtraBed = roomType.extra_bed_adult_price || 0;
    extraBedCost = extraBedsNeeded * pricePerExtraBed * nights;
    if (extraBedCost > 0) {
      breakdown.push({
        label: `سرير إضافي للبالغ × ${extraBedsNeeded}`,
        detail: `${pricePerExtraBed.toLocaleString('ar-EG')} RUB × ${extraBedsNeeded} × ${nights} ليال`,
        amount: extraBedCost
      });
    }
  }

  // ==========================================
  // 9) حساب تكلفة الوجبات
  // ==========================================
  let mealCost = 0;
  let mealPlan = null;
  if (meal_plan_id) {
    mealPlan = db.prepare(`
      SELECT * FROM hotel_meal_plans WHERE id = ? AND hotel_id = ? AND active = 1
    `).get(meal_plan_id, hotel_id);

    if (mealPlan) {
      const nightsForMeal = mealPlan.per_night ? nights : 1;

      // 🆕 حساب الوجبات للبالغين
      const adultsCost = mealPlan.price_per_person * adults * nightsForMeal;
      if (adultsCost > 0) {
        mealCost += adultsCost;
        breakdown.push({
          label: `${mealPlan.name} — بالغين × ${adults}`,
          detail: `${mealPlan.price_per_person.toLocaleString('ar-EG')} RUB × ${adults} × ${nightsForMeal} ${mealPlan.per_night ? 'ليال' : 'مرة'}`,
          amount: adultsCost
        });
      }

      // 🆕 حساب الوجبات للأطفال حسب العمر
      const childMealPolicies = db.prepare(`
        SELECT * FROM hotel_child_meal_policies 
        WHERE meal_plan_id = ? 
        ORDER BY age_from
      `).all(meal_plan_id);

      if (childMealPolicies.length > 0 && children_ages.length > 0) {
        for (const age of children_ages) {
          const policy = childMealPolicies.find(p => age >= p.age_from && age <= p.age_to);
          if (policy) {
            const childMealCost = policy.price_per_person * nightsForMeal;
            if (childMealCost > 0) {
              mealCost += childMealCost;
              breakdown.push({
                label: `${mealPlan.name} — طفل ${age} سنة`,
                detail: `${policy.price_per_person.toLocaleString('ar-EG')} RUB × ${nightsForMeal} ${mealPlan.per_night ? 'ليال' : 'مرة'}`,
                amount: childMealCost
              });
            } else {
              breakdown.push({
                label: `${mealPlan.name} — طفل ${age} سنة (مجاني)`,
                detail: '',
                amount: 0
              });
            }
          } else {
            // لا توجد سياسة → احسبه بسعر البالغ
            const adultMealCost = mealPlan.price_per_person * nightsForMeal;
            mealCost += adultMealCost;
            breakdown.push({
              label: `${mealPlan.name} — طفل ${age} سنة (لا توجد سياسة → سعر بالغ)`,
              detail: `${mealPlan.price_per_person.toLocaleString('ar-EG')} RUB × ${nightsForMeal}`,
              amount: adultMealCost
            });
          }
        }
      } else if (children_ages.length > 0) {
        // لا توجد سياسات → احسب جميع الأطفال بسعر البالغ
        const childMealCost = mealPlan.price_per_person * children_ages.length * nightsForMeal;
        if (childMealCost > 0) {
          mealCost += childMealCost;
          breakdown.push({
            label: `${mealPlan.name} — أطفال (${children_ages.length})`,
            detail: `${mealPlan.price_per_person.toLocaleString('ar-EG')} RUB × ${children_ages.length} × ${nightsForMeal}`,
            amount: childMealCost
          });
        }
      }
    }
  }

  // ==========================================
  // 10) الإجمالي
  // ==========================================
  const total = roomCost + childrenCost + extraBedCost + mealCost;

  return {
    ok: true,
    hotel_id,
    room_type_id,
    room_type_name: roomType.name,
    date_from,
    date_to,
    nights,
    adults,
    children_ages,
    children_count: children_ages.length,
    total_guests: totalGuests,
    season_name: seasonName,
    base_price_per_night: basePricePerNight,
    room_cost: roomCost,
    children_cost: childrenCost,
    extra_bed_cost: extraBedCost,
    meal_cost: mealCost,
    meal_plan: mealPlan ? { id: mealPlan.id, name: mealPlan.name } : null,
    total,
    currency: 'RUB',
    breakdown
  };
}
