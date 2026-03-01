import { eventSource, event_types, getContext, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const extensionName = 'reproductive-tracker';
const extensionFolderPath = `scripts/extensions/third_party/${extensionName}`;

// ============ DEFAULTS ============
const DEFAULTS = {
    enabled: true, showInChat: true, cycleDay: 1, cycleLength: 28,
    ovulationDay: 14, arousal: 0, libido: 50, baselineLibido: 50,
    lastSexDaysAgo: -1, contraception: 'none', conceptionDaysAgo: -1,
    pregnant: false, pregnancyWeek: 0, pregnancyDay: 0,
    pregnancyConfirmed: false, babyGender: '', mood: 'normal',
    energy: 70, bbt: 36.3,
};

// ============ STATE ============
function charKey() {
    try { const c = getContext(); return String(c.characterId ?? c.groupId ?? 'default'); }
    catch { return 'default'; }
}

function S() {
    if (!extension_settings[extensionName]) extension_settings[extensionName] = {};
    const k = charKey();
    if (!extension_settings[extensionName][k]) extension_settings[extensionName][k] = JSON.parse(JSON.stringify(DEFAULTS));
    const s = extension_settings[extensionName][k];
    for (const p in DEFAULTS) if (!(p in s)) s[p] = DEFAULTS[p];
    return s;
}

function save() { try { saveSettingsDebounced(); } catch(e) { console.warn('[RT]', e); } }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ============ BIOLOGY ============
const FERT = {'-5':4,'-4':8,'-3':14,'-2':22,'-1':27,'0':25,'1':8,'2':1};

function phase(d, ov, len) {
    if (d<=5) return {n:'Менструация',c:'#e94560',e:'🩸'};
    if (d<=ov-4) return {n:'Фолликулярная',c:'#4dabf7',e:'🌱'};
    if (d<=ov+1) return {n:'Фертильное окно',c:'#ff6b6b',e:'🥚'};
    if (d>len-4) return {n:'ПМС',c:'#cc5de8',e:'⚡'};
    return {n:'Лютеиновая',c:'#9c27b0',e:'🌙'};
}

function fertPct(d, ov) { return FERT[String(d - ov)] || 0; }

function fertInfo(p) {
    if (!p) return {l:'Нефертильна',e:'⚪',c:'#555'};
    if (p<=5) return {l:'Очень низкая',e:'🟢',c:'#4caf50'};
    if (p<=10) return {l:'Низкая',e:'🟡',c:'#ffeb3b'};
    if (p<=20) return {l:'Высокая',e:'🟠',c:'#ff9800'};
    return {l:'Очень высокая',e:'🔴',c:'#f44336'};
}

function libLabel(v) {
    if (v<=15) return 'Очень низкое'; if (v<=30) return 'Низкое';
    if (v<=50) return 'Норма'; if (v<=70) return 'Повышенное';
    if (v<=85) return 'Высокое'; return 'Очень высокое';
}

function moodStr(m) {
    return {euphoric:'🤩 Эйфория',happy:'😊 Хорошее',normal:'😐 Спокойное',
        irritable:'😤 Раздражение',sad:'😢 Грусть',anxious:'😰 Тревога'}[m]||'😐 Спокойное';
}

function calcSymptoms(s) {
    if (s.pregnant) return pregSym(s.pregnancyWeek);
    const d=s.cycleDay, ov=s.ovulationDay, len=s.cycleLength;
    if (d<=2){s.energy=35;s.mood='irritable';return 'Сильные спазмы, обильные выделения, усталость';}
    if (d<=5){s.energy=50;s.mood='normal';return 'Умеренные выделения, восстановление';}
    if (d<=ov-4){s.energy=85;s.mood='happy';return 'Прилив энергии, хорошее настроение';}
    if (d<=ov+1){s.energy=90;s.mood='euphoric';return 'Повышенное либидо, прозрачная слизь, овуляция';}
    if (d>len-4){s.energy=40;s.mood='irritable';return 'Раздражительность, тяга к еде, вздутие, спазмы';}
    s.energy=60;s.mood='normal';return 'Стабильное состояние, лёгкая усталость';
}

function pregSym(w) {
    if (w<=4) return 'Имплантация, лёгкая усталость';
    if (w<=8) return 'Тошнота, чувствительность к запахам, усталость';
    if (w<=12) return 'Тошнота (пик), эмоциональные перепады';
    if (w<=16) return 'Тошнота уходит, энергия↑, живот округляется';
    if (w<=20) return 'Первые шевеления, рост живота';
    if (w<=24) return 'Активные шевеления, изжога, отёки';
    if (w<=28) return 'Тренировочные схватки, одышка, боли в спине';
    if (w<=32) return 'Сильные шевеления, усталость, молозиво';
    if (w<=36) return 'Опущение живота, давление на таз, бессонница';
    return 'Готовность к родам, схватки, давление';
}

function fetalSize(w) {
    const t=[[4,'маковое зерно','2мм','<1г'],[8,'малина','1.6см','1г'],[12,'лайм','5.4см','14г'],
        [16,'авокадо','11.6см','100г'],[20,'банан','25.6см','300г'],[24,'кукуруза','30см','600г'],
        [28,'баклажан','37.6см','1кг'],[32,'пек. капуста','42см','1.7кг'],[36,'папайя','47.4см','2.6кг'],
        [40,'арбуз 🍉','51см','3.4кг']];
    for (const [mw,sz,l,wt] of t) if (w<=mw) return {sz,l,wt};
    return t[t.length-1];
}

function fetalDev(w) {
    if (w<=4) return 'Имплантация в стенку матки';
    if (w<=8) return 'Формируются руки и ноги, сердце бьётся';
    if (w<=12) return 'Все органы сформированы, рефлексы';
    if (w<=16) return 'Мимические мышцы, глотает воды';
    if (w<=20) return 'Активные движения, можно узнать пол';
    if (w<=24) return 'Лёгкие развиваются, реагирует на звук';
    if (w<=28) return 'Открывает глаза, различает голоса';
    if (w<=32) return 'Кости крепнут, накапливает жир';
    if (w<=36) return 'Лёгкие созревают, головное предлежание';
    return 'Полностью развит, готов к рождению! 🎉';
}

// ============ ADVANCE TIME ============
function advance(n) {
    const s = S(); if (n <= 0) return;
    if (s.pregnant) {
        s.pregnancyDay += n;
        s.pregnancyWeek = Math.min(Math.floor(s.pregnancyDay / 7), 40);
    } else {
        s.cycleDay += n;
        while (s.cycleDay > s.cycleLength) s.cycleDay -= s.cycleLength;
    }
    if (s.lastSexDaysAgo >= 0) s.lastSexDaysAgo += n;
    if (s.conceptionDaysAgo >= 0 && !s.pregnant) {
        s.conceptionDaysAgo += n;
        if (s.conceptionDaysAgo >= 14) {
            s.pregnant = true; s.pregnancyConfirmed = true;
            s.pregnancyDay = s.conceptionDaysAgo;
            s.pregnancyWeek = Math.floor(s.pregnancyDay / 7);
            s.conceptionDaysAgo = -1;
            s.babyGender = Math.random() > 0.5 ? 'male' : 'female';
        }
    }
    s.arousal = clamp(s.arousal - n * 3, 0, 100);
    // libido
    if (s.pregnant) {
        s.libido = s.pregnancyWeek<=13?clamp(s.baselineLibido-25,10,100):s.pregnancyWeek<=27?clamp(s.baselineLibido+15,10,100):clamp(s.baselineLibido-20,5,100);
    } else {
        const dto = s.ovulationDay - s.cycleDay;
        let mod = 0;
        if (s.cycleDay<=5) mod=-20; else if (dto>3) mod=10; else if (dto>=-1) mod=30; else if (s.cycleLength-s.cycleDay>4) mod=-5; else mod=-15;
        s.libido = clamp(s.baselineLibido + mod, 5, 100);
    }
    s.bbt = s.pregnant ? +(36.7+Math.random()*0.3).toFixed(1) : s.cycleDay<=s.ovulationDay ? +(36.1+Math.random()*0.2).toFixed(1) : +(36.5+Math.random()*0.3).toFixed(1);
    save();
}

// ============ EVENTS ============
function doEvent(type, opts) {
    const s = S();
    if (type==='flirt') s.arousal=clamp(s.arousal+8+Math.floor(Math.random()*8),0,100);
    else if (type==='kiss') s.arousal=clamp(s.arousal+12+Math.floor(Math.random()*8),0,100);
    else if (type==='touch') s.arousal=clamp(s.arousal+18+Math.floor(Math.random()*8),0,100);
    else if (type==='orgasm') s.arousal=clamp(20+Math.floor(Math.random()*15),0,100);
    else if (type==='stress'){s.arousal=clamp(s.arousal-20,0,100);s.mood='anxious';}
    else if (type==='sex') {
        s.arousal=clamp(s.arousal+25+Math.floor(Math.random()*15),0,100);
        s.lastSexDaysAgo=0;
        const prot = (opts && opts.prot) || s.contraception!=='none';
        const fp = fertPct(s.cycleDay, s.ovulationDay);
        if (!prot && fp>0 && !s.pregnant && s.conceptionDaysAgo<0) {
            if (Math.random()*100 < fp) s.conceptionDaysAgo = 0;
        }
    }
    save();
}

// ============ PARSE TEXT ============
function parseMsg(text) {
    const s = S(); if (!s.enabled || !text) return;
    let days = 0;
    if (/на следующ|next day|утром|проснул/i.test(text)) days=Math.max(days,1);
    if (/через пару дней/i.test(text)) days=Math.max(days,2);
    if (/через несколько дней|few days/i.test(text)) days=Math.max(days,3);
    if (/через неделю|week later|спустя неделю/i.test(text)) days=Math.max(days,7);
    if (/через месяц|month later/i.test(text)) days=Math.max(days,28);
    const dm=text.match(/через\s*(\d+)\s*дн/i); if(dm) days=Math.max(days,+dm[1]);
    const wm=text.match(/через\s*(\d+)\s*недел/i); if(wm) days=Math.max(days,+wm[1]*7);
    if (days>0) advance(days);

    if (/флирт|подмигн|игриво|шепч|дразн|flirt|wink/i.test(text)) doEvent('flirt');
    if (/поцелу|целу|kiss/i.test(text)) doEvent('kiss');
    if (/ласка|гладит|прикос|обним|трогает|touch|caress/i.test(text)) doEvent('touch');
    if (/оргазм|кончила|climax/i.test(text)) doEvent('orgasm');
    if (/секс|трахает|проникн|входит|кончает|sex|fuck|занялись любовью/i.test(text)) {
        const prot=/презерватив|condom|защит/i.test(text);
        doEvent('sex',{prot});
    }
    if (/стресс|плач|рыда|испуг|страх|паник/i.test(text)) doEvent('stress');
}

// ============ RENDER ============
function render() {
    const s = S();
    if (s.pregnant && s.pregnancyConfirmed) return renderPreg(s);
    return renderCycle(s);
}

function renderCycle(s) {
    const ph = phase(s.cycleDay, s.ovulationDay, s.cycleLength);
    const fp = fertPct(s.cycleDay, s.ovulationDay);
    const fi = fertInfo(fp);
    const sym = calcSymptoms(s);
    const contra = {none:'❌ Нет',condom:'🟡 Презерватив',pill:'💊 ОК',iud:'🔵 Спираль',implant:'🟢 Имплант'}[s.contraception]||'❌ Нет';
    const sex = s.lastSexDaysAgo<0?'Никогда':s.lastSexDaysAgo===0?'Сегодня':s.lastSexDaysAgo+' дн.';
    const prg = s.conceptionDaysAgo<0?'Нет':s.conceptionDaysAgo<6?'⏳ Ожидание':'⚠️ Имплантация';
    const pct = (s.cycleDay/s.cycleLength*100).toFixed(0);
    const ovPct = (s.ovulationDay/s.cycleLength*100).toFixed(0);
    let w='';
    if (fp>=20) w+='⚠️ Высокий шанс зачатия!<br>';
    if (s.conceptionDaysAgo>=6) w+='⚠️ Возможная имплантация<br>';

    return `<div class="rpt-box">
<div class="rpt-hdr"><span class="rpt-t">♀ РЕПРОДУКТИВНЫЙ СТАТУС</span><span class="rpt-badge">${ph.e} ${ph.n}</span></div>
<div class="rpt-track"><div class="rpt-prog" style="width:${pct}%;background:${ph.c}"></div><div class="rpt-ov" style="left:${ovPct}%">▼</div></div>
<div class="rpt-lbl"><span>День ${s.cycleDay}/${s.cycleLength}</span><span style="color:${ph.c}">Овуляция: д.${s.ovulationDay}</span></div>
<div class="rpt-g">
<div class="rpt-c"><div class="rpt-cl">🥚 Фертильность</div><div class="rpt-cv" style="color:${fi.c}">${fi.e} ${fp}%</div><div class="rpt-cs">${fi.l}</div></div>
<div class="rpt-c"><div class="rpt-cl">🔥 Возбуждение</div><div class="rpt-cv" style="color:#e91e63">${s.arousal}%</div><div class="rpt-bar"><div style="background:linear-gradient(90deg,#e91e63,#ff5722);width:${s.arousal}%;height:100%;border-radius:3px"></div></div></div>
<div class="rpt-c"><div class="rpt-cl">💋 Либидо</div><div class="rpt-cv" style="color:#ff4081">${libLabel(s.libido)}</div><div class="rpt-bar"><div style="background:#ff4081;width:${s.libido}%;height:100%;border-radius:3px"></div></div></div>
<div class="rpt-c"><div class="rpt-cl">⚡ Энергия</div><div class="rpt-cv" style="color:#4dabf7">${s.energy}%</div><div class="rpt-bar"><div style="background:#4dabf7;width:${s.energy}%;height:100%;border-radius:3px"></div></div></div>
</div>
<div class="rpt-rows">
<div class="rpt-r"><span>🌡️ ${s.bbt}°C</span><span>🛡️ ${contra}</span></div>
<div class="rpt-r"><span>🍆 ${sex}</span><span>🤰 ${prg}</span></div>
<div class="rpt-r"><span>${moodStr(s.mood)}</span></div>
</div>
<div class="rpt-sym">💫 ${sym}</div>
${w?'<div class="rpt-warn">'+w+'</div>':''}
<div class="rpt-btns">
<button class="rpt-btn" data-rpt="p1">⏩+1д</button>
<button class="rpt-btn" data-rpt="p7">📅+7д</button>
<button class="rpt-btn" data-rpt="flirt">😘</button>
<button class="rpt-btn" data-rpt="kiss">💋</button>
<button class="rpt-btn" data-rpt="touch">🤚</button>
<button class="rpt-btn" data-rpt="sex">🔥</button>
</div>
</div>`;
}

function renderPreg(s) {
    const sym = pregSym(s.pregnancyWeek);
    const fi = fetalSize(s.pregnancyWeek);
    const dev = fetalDev(s.pregnancyWeek);
    const tri = s.pregnancyWeek<=13?'1-й':s.pregnancyWeek<=27?'2-й':'3-й';
    const pct = Math.min(s.pregnancyWeek/40*100,100).toFixed(0);
    const gender = s.pregnancyWeek>=18?(s.babyGender==='male'?'♂ Мальчик':'♀ Девочка'):'❓ Рано';
    let w='';
    if (s.pregnancyWeek>=36) w+='🏥 Скоро роды!<br>';

    return `<div class="rpt-box rpt-preg">
<div class="rpt-hdr rpt-hdr-p"><span class="rpt-t" style="color:#ff6b9d">🤰 БЕРЕМЕННОСТЬ</span><span class="rpt-badge">${tri} триместр</span></div>
<div class="rpt-track"><div class="rpt-prog" style="width:${pct}%;background:linear-gradient(90deg,#ff6b9d,#e91e63)"></div></div>
<div class="rpt-lbl"><span style="color:#ff6b9d">Неделя ${s.pregnancyWeek}/40</span><span>~${40-s.pregnancyWeek} нед. до родов</span></div>
<div class="rpt-g">
<div class="rpt-c"><div class="rpt-cl">👶 Размер</div><div class="rpt-cv" style="color:#ff6b9d">${fi.sz}</div><div class="rpt-cs">${fi.l}, ${fi.wt}</div></div>
<div class="rpt-c"><div class="rpt-cl">🔥 Возбуждение</div><div class="rpt-cv" style="color:#e91e63">${s.arousal}%</div><div class="rpt-bar"><div style="background:#e91e63;width:${s.arousal}%;height:100%;border-radius:3px"></div></div></div>
<div class="rpt-c"><div class="rpt-cl">💋 Либидо</div><div class="rpt-cv" style="color:#ff4081">${libLabel(s.libido)}</div><div class="rpt-bar"><div style="background:#ff4081;width:${s.libido}%;height:100%;border-radius:3px"></div></div></div>
<div class="rpt-c"><div class="rpt-cl">⚡ Энергия</div><div class="rpt-cv" style="color:#4dabf7">${s.energy}%</div><div class="rpt-bar"><div style="background:#4dabf7;width:${s.energy}%;height:100%;border-radius:3px"></div></div></div>
</div>
<div class="rpt-rows">
<div class="rpt-r"><span>👶 Пол: ${gender}</span><span>${moodStr(s.mood)}</span></div>
</div>
<div class="rpt-dev">👶 ${dev}</div>
<div class="rpt-sym">💫 ${sym}</div>
${w?'<div class="rpt-warn">'+w+'</div>':''}
<div class="rpt-btns">
<button class="rpt-btn" data-rpt="p1">⏩+1д</button>
<button class="rpt-btn" data-rpt="p7">📅+7д</button>
<button class="rpt-btn" data-rpt="p28">📆+4нед</button>
</div>
</div>`;
}

// ============ UI SYNC ============
function syncUI() {
    const s = S();
    try {
        $('#rpt_enabled').prop('checked', s.enabled);
        $('#rpt_showInChat').prop('checked', s.showInChat);
        $('#rpt_day').val(s.cycleDay); $('#rpt_day_val').text(s.cycleDay);
        $('#rpt_len').val(s.cycleLength); $('#rpt_len_val').text(s.cycleLength);
        $('#rpt_contra').val(s.contraception);
        $('#rpt_ar').val(s.arousal); $('#rpt_ar_val').text(s.arousal);
        $('#rpt_bl').val(s.baselineLibido); $('#rpt_bl_val').text(s.baselineLibido);
        $('#rpt_pregnant').prop('checked', s.pregnant);
        $('#rpt_wk').val(s.pregnancyWeek); $('#rpt_wk_val').text(s.pregnancyWeek);
    } catch(e) { console.warn('[RT] syncUI', e); }
}

function refreshBlock() {
    const last = $('#chat .rpt-box').last();
    if (last.length) last.replaceWith(render());
}

function insertBlock(mesId) {
    const s = S();
    if (!s.enabled || !s.showInChat) return;
    try {
        const ctx = getContext();
        const msg = ctx.chat?.[mesId];
        if (!msg || msg.is_user) return;
        setTimeout(() => {
            const el = $(`#chat .mes[mesid="${mesId}"] .mes_text`);
            if (el.length) {
                el.find('.rpt-box').remove();
                el.append(render());
            }
        }, 200);
    } catch(e) { console.warn('[RT] insert', e); }
}

// ============ INIT (jQuery ready) ============
jQuery(async () => {
    console.log('[RT] Starting...');

    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }

    // Load template.html into settings panel
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/template.html`);
        $('#extensions_settings2').append(settingsHtml);
        console.log('[RT] Template loaded');
    } catch(e) {
        console.error('[RT] Failed to load template.html:', e);
        return;
    }

    syncUI();

    // Settings bindings
    $('#rpt_enabled').on('change', function() { S().enabled = this.checked; save(); });
    $('#rpt_showInChat').on('change', function() { S().showInChat = this.checked; save(); });
    $('#rpt_day').on('input', function() { const v=+this.value; $('#rpt_day_val').text(v); S().cycleDay=v; save(); });
    $('#rpt_len').on('input', function() { const v=+this.value; $('#rpt_len_val').text(v); const s=S(); s.cycleLength=v; s.ovulationDay=v-14; save(); });
    $('#rpt_contra').on('change', function() { S().contraception=this.value; save(); });
    $('#rpt_ar').on('input', function() { const v=+this.value; $('#rpt_ar_val').text(v); S().arousal=v; save(); });
    $('#rpt_bl').on('input', function() { const v=+this.value; $('#rpt_bl_val').text(v); S().baselineLibido=v; save(); });
    $('#rpt_pregnant').on('change', function() { const s=S(); s.pregnant=this.checked; s.pregnancyConfirmed=this.checked; if(!this.checked){s.pregnancyWeek=0;s.pregnancyDay=0;} save(); syncUI(); });
    $('#rpt_wk').on('input', function() { const v=+this.value; $('#rpt_wk_val').text(v); const s=S(); s.pregnancyWeek=v; s.pregnancyDay=v*7; save(); });
    $('#rpt_btn_p1').on('click', () => { advance(1); syncUI(); refreshBlock(); });
    $('#rpt_btn_p7').on('click', () => { advance(7); syncUI(); refreshBlock(); });
    $('#rpt_btn_p28').on('click', () => { advance(28); syncUI(); refreshBlock(); });
    $('#rpt_btn_reset').on('click', () => {
        if (!confirm('Сбросить трекер?')) return;
        extension_settings[extensionName][charKey()] = JSON.parse(JSON.stringify(DEFAULTS));
        save(); syncUI(); refreshBlock();
    });

    // Chat buttons (delegated)
    $(document).on('click', '.rpt-btn', function(e) {
        e.preventDefault(); e.stopPropagation();
        const a = $(this).data('rpt');
        if (a==='p1') advance(1);
        else if (a==='p7') advance(7);
        else if (a==='p28') advance(28);
        else if (a==='flirt') doEvent('flirt');
        else if (a==='kiss') doEvent('kiss');
        else if (a==='touch') doEvent('touch');
        else if (a==='sex') doEvent('sex',{prot:S().contraception!=='none'});
        refreshBlock(); syncUI();
    });

    // ST events
    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
        try {
            const msg = getContext().chat?.[mesId];
            if (msg?.mes) parseMsg(msg.mes);
            insertBlock(mesId);
        } catch(e) { console.warn('[RT] recv', e); }
    });

    eventSource.on(event_types.MESSAGE_SENT, (mesId) => {
        try {
            const msg = getContext().chat?.[mesId];
            if (msg?.mes) parseMsg(msg.mes);
        } catch(e) { console.warn('[RT] sent', e); }
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        syncUI();
        setTimeout(() => {
            const s = S();
            if (!s.enabled || !s.showInChat) return;
            const chat = getContext().chat;
            if (!chat?.length) return;
            for (let i = chat.length - 1; i >= 0; i--) {
                if (!chat[i].is_user) { insertBlock(i); break; }
            }
        }, 500);
    });

    console.log('[RT] ✅ Ready!');
});
